import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import prisma from '../lib/prisma';
import { BookStatus } from '@prisma/client';
import logger from '../utils/logger';
import {
  getSevakDistributionOverview,
  getMasterSummaryExportData,
  TIER_DEFS,
  type TierDefinition,
} from '../services/prasad.service';

const TIER_KEYS = new Set<string>(TIER_DEFS.map((t) => t.key));
const TIER_MAP = new Map<string, TierDefinition>(TIER_DEFS.map((t) => [t.key, t]));

export async function getSevakOverview(req: Request, res: Response): Promise<void> {
  try {
    const { sevakId } = req.params as { sevakId: string };
    const overview = await getSevakDistributionOverview(sevakId);

    if (!overview) {
      res.status(404).json({ error: 'Sevak not found' });
      return;
    }

    res.status(200).json(overview);
  } catch (err) {
    logger.error('Get prasad overview error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

interface TierDistributionInput {
  slabTier: string;
  distributeCount: number;
}

interface DistributeBody {
  sevakId: string;
  tierDistributions: TierDistributionInput[];
  receiptIdsToMark: string[];
}

function isValidDistributeBody(body: unknown): body is DistributeBody {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as DistributeBody;
  return (
    typeof b.sevakId === 'string' &&
    b.sevakId.trim().length > 0 &&
    Array.isArray(b.tierDistributions) &&
    b.tierDistributions.length > 0 &&
    Array.isArray(b.receiptIdsToMark) &&
    b.receiptIdsToMark.length > 0
  );
}

export async function distributePrasad(
  req: Request<Record<string, never>, unknown, DistributeBody>,
  res: Response
): Promise<void> {
  try {
    const body = req.body;

    if (!isValidDistributeBody(body)) {
      res.status(400).json({ error: 'Invalid request body' });
      return;
    }

    const { sevakId, tierDistributions, receiptIdsToMark } = body;

    if (!sevakId?.trim() || tierDistributions.length === 0 || receiptIdsToMark.length === 0) {
      res.status(400).json({ error: 'sevakId, tierDistributions and receiptIdsToMark are required' });
      return;
    }

    for (const tier of tierDistributions) {
      if (!TIER_KEYS.has(tier.slabTier)) {
        res.status(400).json({ error: `Invalid slab tier: ${tier.slabTier}` });
        return;
      }
      if (
        typeof tier.distributeCount !== 'number' ||
        !Number.isInteger(tier.distributeCount) ||
        tier.distributeCount < 0
      ) {
        res.status(400).json({ error: `Invalid distributeCount for ${tier.slabTier}` });
        return;
      }
    }

    const overview = await getSevakDistributionOverview(sevakId);
    if (!overview) {
      res.status(404).json({ error: 'Sevak not found' });
      return;
    }

    for (const tier of tierDistributions) {
      const tierOverview = overview.tiers.find((t) => t.slabTier === tier.slabTier);
      if (!tierOverview) {
        res.status(400).json({ error: `Tier not found: ${tier.slabTier}` });
        return;
      }
      if (tier.distributeCount > tierOverview.remainingBoxes) {
        res.status(400).json({
          error: `Cannot allocate more than remaining boxes for ${tier.slabTier}. Requested: ${tier.distributeCount}, Remaining: ${tierOverview.remainingBoxes}`,
        });
        return;
      }
    }

    const allReceiptIds = new Set(receiptIdsToMark);
    if (allReceiptIds.size !== receiptIdsToMark.length) {
      res.status(400).json({ error: 'Duplicate receipt IDs in request' });
      return;
    }

    const targetReceipts = overview.receiptsByBook
      .flatMap((g) => g.receipts)
      .filter((r) => allReceiptIds.has(r.id));

    if (targetReceipts.length !== receiptIdsToMark.length) {
      const foundIds = new Set(targetReceipts.map((r) => r.id));
      const missing = receiptIdsToMark.filter((id) => !foundIds.has(id));
      res.status(400).json({ error: `Receipts not found for this sevak: ${missing.join(', ')}` });
      return;
    }

    const alreadyServed = targetReceipts.filter((r) => r.prasadDistributed);
    if (alreadyServed.length > 0) {
      res.status(409).json({
        error: `Already served receipts: ${alreadyServed.map((r) => r.receiptNo).join(', ')}`,
      });
      return;
    }

    const userId = req.user?.userId ?? 'unknown';
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      for (const tier of tierDistributions) {
        if (tier.distributeCount === 0) continue;
        await tx.prasadDistribution.upsert({
          where: {
            sevakId_slabTier: {
              sevakId,
              slabTier: tier.slabTier,
            },
          },
          update: {
            distributedBoxes: {
              increment: tier.distributeCount,
            },
          },
          create: {
            sevakId,
            slabTier: tier.slabTier,
            distributedBoxes: tier.distributeCount,
          },
        });
      }

      await tx.sevaReceipt.updateMany({
        where: {
          id: { in: receiptIdsToMark },
          sevakId,
        },
        data: {
          prasadDistributed: true,
          distributedAt: now,
          distributedBy: userId,
        },
      });

      const affectedBooks = new Set(
        targetReceipts.map((r) => {
          const found = overview.receiptsByBook.find((g) => g.receipts.some((rc) => rc.id === r.id));
          return found?.bookNumber ?? '';
        })
      );

      for (const bookNumber of affectedBooks) {
        if (!bookNumber) continue;

        const unservedCount = await tx.sevaReceipt.count({
          where: {
            sevakId,
            bookNumber,
            prasadDistributed: false,
          },
        });

        const totalCount = await tx.sevaReceipt.count({
          where: {
            sevakId,
            bookNumber,
          },
        });

        let nextStatus: BookStatus = BookStatus.ASSIGNED;
        if (unservedCount === 0 && totalCount > 0) {
          nextStatus = BookStatus.SUBMITTED;
        } else if (unservedCount < totalCount) {
          nextStatus = BookStatus.PARTIALLY_SUBMITTED;
        }

        await tx.bookAllocation.updateMany({
          where: {
            sevakId,
            bookNumber,
          },
          data: {
            status: nextStatus,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId,
          action: 'PRASAD_DISTRIBUTE',
          details: {
            sevakId,
            tierDistributions,
            receiptsServed: receiptIdsToMark.length,
          } as any,
        },
      });
    });

    logger.info('Prasad distributed', {
      userId,
      sevakId,
      tierDistributions,
      receiptsServed: receiptIdsToMark.length,
    });

    res.status(200).json({
      message: 'Prasad distributed successfully',
      receiptsServed: receiptIdsToMark.length,
    });
  } catch (err) {
    logger.error('Distribute prasad error', { error: (err as Error).message, stack: (err as Error).stack });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function exportMasterSummaryExcel(_req: Request, res: Response): Promise<void> {
  try {
    const { sevaks, tierRows, auditRows } = await getMasterSummaryExportData();

    const workbook = new ExcelJS.Workbook();

    const summarySheet = workbook.addWorksheet('Master Sevak Summary');
    summarySheet.columns = [
      { header: 'Sevak Code', key: 'sevakCode', width: 16 },
      { header: 'Name', key: 'fullName', width: 28 },
      { header: 'Phone', key: 'mobile', width: 16 },
      { header: 'Mandal', key: 'mandal', width: 20 },
      { header: 'Kshetra', key: 'kshetra', width: 20 },
      { header: 'Total Seva ₹', key: 'totalSevaAmount', width: 16 },
      { header: 'Total Books', key: 'totalBooks', width: 14 },
      { header: 'Total Receipts', key: 'totalReceipts', width: 16 },
      { header: 'Boxes Eligible', key: 'eligibleBoxes', width: 16 },
      { header: 'Boxes Given', key: 'givenBoxes', width: 14 },
      { header: 'Boxes Pending', key: 'pendingBoxes', width: 16 },
    ];
    summarySheet.addRows(sevaks);

    const tierSheet = workbook.addWorksheet('Tier-wise Box Allocation');
    tierSheet.columns = [
      { header: 'Sevak Code', key: 'sevakCode', width: 16 },
      { header: 'Slab Tier', key: 'tierLabel', width: 18 },
      { header: 'Total Receipts', key: 'totalReceipts', width: 16 },
      { header: 'Unserved Receipts', key: 'unservedReceipts', width: 18 },
      { header: 'Eligible Boxes', key: 'eligibleBoxes', width: 16 },
      { header: 'Distributed Boxes', key: 'distributedBoxes', width: 18 },
      { header: 'Remaining Boxes', key: 'remainingBoxes', width: 18 },
    ];
    tierSheet.addRows(tierRows);

    const auditSheet = workbook.addWorksheet('Receipt Audit Trail');
    auditSheet.columns = [
      { header: 'Sevak Code', key: 'sevakCode', width: 16 },
      { header: 'Book No', key: 'bookNumber', width: 14 },
      { header: 'Receipt No', key: 'receiptNo', width: 14 },
      { header: 'Donor', key: 'donorName', width: 28 },
      { header: 'Amount ₹', key: 'amount', width: 14 },
      { header: 'Distributed', key: 'distributed', width: 14 },
      { header: 'Distributed At', key: 'distributedAt', width: 24 },
    ];
    auditSheet.addRows(
      auditRows.map((r) => ({
        ...r,
        distributed: r.distributed ? 'Yes' : 'No',
      }))
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="master-summary.xlsx"'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    logger.error('Export master summary error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}
