import { Request, Response } from 'express';
import { Prisma, BookStatus } from '@prisma/client';
import ExcelJS from 'exceljs';
import prisma from '../lib/prisma';
import { logAuditEvent, type AuditDetails } from '../utils/audit';
import logger from '../utils/logger';
import { parsePaginationParams } from '../utils/pagination';

interface ReceiptItem {
  sevakId?: string;
  bookNumber: string;
  receiptNo: string;
  donorName: string;
  donorMobile?: string | null;
  amount: number;
  entryDate?: string | null;
}

interface CreateReceiptsBody {
  sevakId?: string;
  receipts?: ReceiptItem[];
  bookNumber?: string;
  receiptNo?: string;
  donorName?: string;
  donorMobile?: string | null;
  amount?: number;
  entryDate?: string | null;
}

function normalizeMobile(value: string | undefined | null): string {
  return (value ?? '').replace(/\D/g, '');
}

function parseAmount(value: unknown): number | null {
  if (value === undefined || value === null) return null;
  const num = Number(value);
  if (Number.isNaN(num) || num <= 0) return null;
  return Math.round(num * 100) / 100;
}

function parseEntryDate(value: unknown): Date | null {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

async function validateAndBuildReceipts(
  body: CreateReceiptsBody
): Promise<Array<Omit<Prisma.SevaReceiptCreateManyInput, 'id' | 'createdAt'>>> {
  let items: ReceiptItem[] = [];

  if (Array.isArray(body.receipts)) {
    items = body.receipts.map((r, i) => ({
      ...r,
      sevakId: (r.sevakId ?? body.sevakId ?? '').trim(),
    }));

    if (items.length === 0) {
      throw new Error('Receipts array is empty');
    }
  } else {
    if (!body.sevakId?.trim()) {
      throw new Error('sevakId is required');
    }
    items = [
      {
        sevakId: body.sevakId.trim(),
        bookNumber: body.bookNumber ?? '',
        receiptNo: body.receiptNo ?? '',
        donorName: body.donorName ?? '',
        donorMobile: body.donorMobile,
        amount: body.amount ?? 0,
        entryDate: body.entryDate,
      },
    ];
  }

  const results: Array<Omit<Prisma.SevaReceiptCreateManyInput, 'id' | 'createdAt'>> = [];
  const seen = new Set<string>();

  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];

    if (!item.sevakId) {
      throw new Error(`Receipt at index ${i} is missing sevakId`);
    }
    if (!item.bookNumber?.trim()) {
      throw new Error(`Receipt at index ${i} is missing bookNumber`);
    }
    if (!item.receiptNo?.trim()) {
      throw new Error(`Receipt at index ${i} is missing receiptNo`);
    }

    const amount = parseAmount(item.amount);
    if (amount === null) {
      throw new Error(`Receipt at index ${i} has an invalid amount`);
    }

    const donorMobile = item.donorMobile ? normalizeMobile(item.donorMobile) : null;
    if (donorMobile && donorMobile.length < 10) {
      throw new Error(`Receipt at index ${i} has an invalid donorMobile`);
    }

    const entryDate = parseEntryDate(item.entryDate) ?? new Date();
    const bookNumber = item.bookNumber.trim();
    const receiptNo = item.receiptNo.trim();

    if (seen.has(receiptNo)) {
      throw new Error(`Duplicate receipt in request: ${receiptNo}`);
    }
    seen.add(receiptNo);

    results.push({
      sevakId: item.sevakId,
      bookNumber,
      receiptNo,
      donorName: item.donorName.trim(),
      donorMobile,
      amount: new Prisma.Decimal(amount),
      entryDate,
    });
  }

  return results;
}

export async function createReceipts(
  req: Request<Record<string, never>, unknown, CreateReceiptsBody>,
  res: Response
): Promise<void> {
  try {
    const data = await validateAndBuildReceipts(req.body);

    const existing = await prisma.sevaReceipt.findMany({
      where: {
        receiptNo: { in: [...new Set(data.map((d) => d.receiptNo))] },
      },
    });

    if (existing.length > 0) {
      const first = existing[0];
      res.status(409).json({
        error: `Receipt already exists: ${first.receiptNo}`,
      });
      return;
    }

    const created = await prisma.sevaReceipt.createMany({
      data: data as Prisma.SevaReceiptCreateManyInput[],
    });

    const actorId = req.user?.userId ?? 'unknown';
    await logAuditEvent(actorId, 'RECEIPTS_CREATED', {
      count: created.count,
      sevakId: data[0]?.sevakId,
    });

    res.status(201).json({ count: created.count });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Receipt')) {
      res.status(400).json({ error: err.message });
      return;
    }
    logger.error('Create receipts error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function searchReceipts(req: Request, res: Response): Promise<void> {
  const { page, limit, skip, take } = parsePaginationParams(req.query);

  const where: Prisma.SevaReceiptWhereInput = {};

  const bookNumber = String(req.query.bookNumber ?? '').trim();
  const receiptNo = String(req.query.receiptNo ?? '').trim();
  const donorName = String(req.query.donorName ?? '').trim();
  const donorMobile = String(req.query.donorMobile ?? '').trim();

  if (bookNumber) where.bookNumber = { equals: bookNumber };
  if (receiptNo) where.receiptNo = { equals: receiptNo };
  if (donorName) where.donorName = { contains: donorName, mode: 'insensitive' as const };
  if (donorMobile) {
    where.donorMobile = { contains: donorMobile };
  }

  try {
    const [total, receipts] = await prisma.$transaction([
      prisma.sevaReceipt.count({ where }),
      prisma.sevaReceipt.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          sevak: { select: { sevakCode: true, fullName: true, mandal: true } },
        },
      }),
    ]);

    const formatted = receipts.map((r) => ({
      ...r,
      amount: Number(r.amount),
    }));

    res.status(200).json({
      receipts: formatted,
      total,
      page,
      limit,
    });
  } catch (err) {
    logger.error('Search receipts error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getSevakReceiptSummary(
  req: Request<{ sevakId: string }>,
  res: Response
): Promise<void> {
  const { sevakId } = req.params;

  try {
    const sevak = await prisma.sevak.findUnique({
      where: { id: sevakId },
      select: { id: true, sevakCode: true, fullName: true, mandal: true },
    });

    if (!sevak) {
      res.status(404).json({ error: 'Sevak not found' });
      return;
    }

    const receipts = await prisma.sevaReceipt.findMany({ where: { sevakId } });

    const groups: Record<string, { amount: number; count: number; subTotal: number }> = {};
    let grandTotal = 0;
    let totalCount = 0;

    for (const r of receipts) {
      const amount = Number(r.amount);
      const key = amount.toFixed(2);
      if (!groups[key]) {
        groups[key] = { amount, count: 0, subTotal: 0 };
      }
      groups[key].count += 1;
      groups[key].subTotal += amount;
      grandTotal += amount;
      totalCount += 1;
    }

    res.status(200).json({
      sevak,
      groups: Object.values(groups).sort((a, b) => a.amount - b.amount),
      grandTotal,
      totalCount,
    });
  } catch (err) {
    logger.error('Get sevak receipt summary error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}

function buildSummaryRows(
  receipts: { amount: Prisma.Decimal }[]
): Array<{ amount: number; count: number; subTotal: number }> {
  const groups: Record<string, { amount: number; count: number; subTotal: number }> = {};
  for (const r of receipts) {
    const amount = Number(r.amount);
    const key = amount.toFixed(2);
    if (!groups[key]) {
      groups[key] = { amount, count: 0, subTotal: 0 };
    }
    groups[key].count += 1;
    groups[key].subTotal += amount;
  }
  return Object.values(groups).sort((a, b) => a.amount - b.amount);
}

export async function exportReceiptsExcel(_req: Request, res: Response): Promise<void> {
  try {
    const receipts = await prisma.sevaReceipt.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        sevak: { select: { sevakCode: true, fullName: true, mandal: true } },
      },
    });

    const workbook = new ExcelJS.Workbook();

    const details = workbook.addWorksheet('Receipts');
    details.columns = [
      { header: 'પ.ભ.શ્રી / Donor Name', key: 'donorName', width: 28 },
      { header: 'મોબાઇલ / Mobile', key: 'donorMobile', width: 16 },
      { header: 'બુક નં. / Book No', key: 'bookNumber', width: 14 },
      { header: 'પહોંચ નં. / Receipt No', key: 'receiptNo', width: 14 },
      { header: 'રકમ / Amount', key: 'amount', width: 14 },
      { header: 'તારીખ / Entry Date', key: 'entryDate', width: 22 },
      { header: 'સેવક કોડ / Sevak Code', key: 'sevakCode', width: 16 },
      { header: 'સેવક નામ / Sevak Name', key: 'sevakName', width: 28 },
      { header: 'મંડળ / Mandal', key: 'mandal', width: 20 },
    ];

    details.addRows(
      receipts.map((r) => ({
        donorName: r.donorName,
        donorMobile: r.donorMobile ?? '',
        bookNumber: r.bookNumber,
        receiptNo: r.receiptNo,
        amount: Number(r.amount),
        entryDate: r.entryDate.toISOString(),
        sevakCode: r.sevak.sevakCode,
        sevakName: r.sevak.fullName,
        mandal: r.sevak.mandal,
      }))
    );

    const summary = workbook.addWorksheet('Summary');
    summary.columns = [
      { header: 'રકમ / Amount', key: 'amount', width: 16 },
      { header: 'કુલ / Count', key: 'count', width: 12 },
      { header: 'પેટાસરવાડો / Sub-total', key: 'subTotal', width: 18 },
    ];

    const summaryRows = buildSummaryRows(receipts);
    const grandTotal = summaryRows.reduce((sum, g) => sum + g.subTotal, 0);
    const totalCount = summaryRows.reduce((sum, g) => sum + g.count, 0);

    summary.addRows(summaryRows);
    summary.addRow({
      amount: 'કુલ/Grand Total',
      count: totalCount,
      subTotal: grandTotal,
    });

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader('Content-Disposition', 'attachment; filename="receipts.xlsx"');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    logger.error('Export receipts error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}

function formatReceipt(receipt: {
  id: string;
  sevakId: string;
  bookNumber: string;
  receiptNo: string;
  donorName: string | null;
  donorMobile: string | null;
  amount: Prisma.Decimal;
  entryDate: Date;
  createdAt: Date;
  sevak?: { sevakCode: string; fullName: string; mandal: string } | null;
}): {
  id: string;
  sevakId: string;
  bookNumber: string;
  receiptNo: string;
  donorName: string;
  donorMobile: string | null;
  amount: number;
  entryDate: string;
  createdAt: string;
  sevak?: { sevakCode: string; fullName: string; mandal: string } | null;
} {
  return {
    ...receipt,
    donorName: receipt.donorName ?? '',
    amount: Number(receipt.amount),
    entryDate: receipt.entryDate.toISOString(),
    createdAt: receipt.createdAt.toISOString(),
    sevak: receipt.sevak ?? undefined,
  };
}

function determineBookStatus(
  receipts: { receiptNo: string }[]
): BookStatus {
  if (receipts.length === 0) {
    return BookStatus.ASSIGNED;
  }

  const numbers: number[] = [];
  for (const r of receipts) {
    const n = Number(r.receiptNo);
    if (Number.isNaN(n) || !Number.isFinite(n) || n < 1) {
      return BookStatus.PARTIALLY_SUBMITTED;
    }
    numbers.push(n);
  }

  const unique = new Set(numbers);
  if (unique.size !== numbers.length) {
    return BookStatus.PARTIALLY_SUBMITTED;
  }

  const max = Math.max(...numbers);
  const min = Math.min(...numbers);
  if (min === 1 && unique.size === max) {
    return BookStatus.SUBMITTED;
  }

  return BookStatus.PARTIALLY_SUBMITTED;
}

async function updateBookStatusForBook(bookNumber: string): Promise<void> {
  const receipts = await prisma.sevaReceipt.findMany({
    where: { bookNumber },
    select: { receiptNo: true },
  });

  const status = determineBookStatus(receipts);

  const allocation = await prisma.bookAllocation.findUnique({
    where: { bookNumber },
  });

  if (allocation && allocation.status !== status) {
    await prisma.bookAllocation.update({
      where: { id: allocation.id },
      data: { status },
    });
  }
}

export async function getSevakReceipts(
  req: Request<{ sevakId: string }>,
  res: Response
): Promise<void> {
  const { sevakId } = req.params;
  const { page, limit, skip, take } = parsePaginationParams(req.query);

  try {
    const sevak = await prisma.sevak.findUnique({
      where: { id: sevakId },
      select: { id: true, sevakCode: true, fullName: true, mandal: true },
    });

    if (!sevak) {
      res.status(404).json({ error: 'Sevak not found' });
      return;
    }

    const where = { sevakId };

    const [total, receipts, books, groups, uniqueBookNumbers] = await prisma.$transaction([
      prisma.sevaReceipt.count({ where }),
      prisma.sevaReceipt.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          sevak: { select: { sevakCode: true, fullName: true, mandal: true } },
        },
      }),
      prisma.bookAllocation.findMany({
        where,
        select: { bookNumber: true, status: true, assignedAt: true },
      }),
      prisma.sevaReceipt.groupBy({
        by: ['amount'],
        where,
        orderBy: { amount: 'asc' },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.sevaReceipt.findMany({
        where,
        select: { bookNumber: true },
        distinct: ['bookNumber'],
      }),
    ]);

    const bookMap = new Map(
      books.map((b) => [
        b.bookNumber,
        { status: b.status, assignedAt: b.assignedAt.toISOString() },
      ])
    );

    const formatted = receipts.map((r) => ({
      ...formatReceipt(r),
      book: bookMap.get(r.bookNumber) ?? null,
    }));

    const summaryGroups = Object.values(
      groups.reduce(
        (acc, g) => {
          const amount = Number(g.amount);
          const count = Number(
            (g._count as { _all?: number | null } | undefined)?._all ?? 0
          );
          const subTotal = Number((g._sum as { amount?: unknown } | undefined)?.amount ?? 0);
          const key = amount.toFixed(2);
          if (!acc[key]) {
            acc[key] = { amount, count: 0, subTotal: 0 };
          }
          acc[key].count += count;
          acc[key].subTotal += subTotal;
          return acc;
        },
        {} as Record<string, { amount: number; count: number; subTotal: number }>
      )
    ).sort((a, b) => a.amount - b.amount);

    const grandTotal = summaryGroups.reduce((sum, g) => sum + g.subTotal, 0);
    const totalCount = summaryGroups.reduce((sum, g) => sum + g.count, 0);
    const uniqueBooks = uniqueBookNumbers.length;

    res.status(200).json({
      sevak,
      receipts: formatted,
      total,
      page,
      limit,
      summary: {
        sevak,
        groups: summaryGroups,
        grandTotal,
        totalCount,
        uniqueBooks,
      },
    });
  } catch (err) {
    logger.error('Get sevak receipts error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}

interface UpdateReceiptBody {
  receiptNo?: string;
  donorName?: string;
  donorMobile?: string | null;
  amount?: number;
}

export async function updateReceipt(
  req: Request<{ receiptId: string }, unknown, UpdateReceiptBody>,
  res: Response
): Promise<void> {
  const { receiptId } = req.params;
  const { receiptNo, donorName, donorMobile, amount } = req.body;

  try {
    const receipt = await prisma.sevaReceipt.findUnique({
      where: { id: receiptId },
    });

    if (!receipt) {
      res.status(404).json({ error: 'Receipt not found' });
      return;
    }

    const data: Prisma.SevaReceiptUpdateInput = {};

    if (receiptNo !== undefined) {
      const trimmed = receiptNo.trim();
      if (!trimmed) {
        res.status(400).json({ error: 'receiptNo is required' });
        return;
      }
      if (trimmed !== receipt.receiptNo) {
        const existing = await prisma.sevaReceipt.findFirst({
          where: {
            receiptNo: trimmed,
            NOT: { id: receiptId },
          },
        });
        if (existing) {
          res.status(409).json({
            error: `Receipt already exists: ${trimmed}`,
          });
          return;
        }
      }
      data.receiptNo = trimmed;
    }

    if (donorName !== undefined) {
      data.donorName = donorName.trim();
    }

    if (donorMobile !== undefined) {
      const cleaned = donorMobile ? normalizeMobile(donorMobile) : null;
      if (cleaned && cleaned.length < 10) {
        res.status(400).json({ error: 'Invalid donorMobile' });
        return;
      }
      data.donorMobile = cleaned;
    }

    if (amount !== undefined) {
      const parsed = parseAmount(amount);
      if (parsed === null) {
        res.status(400).json({ error: 'Invalid amount' });
        return;
      }
      data.amount = new Prisma.Decimal(parsed);
    }

    const updated = await prisma.sevaReceipt.update({
      where: { id: receiptId },
      data,
      include: {
        sevak: { select: { sevakCode: true, fullName: true, mandal: true } },
      },
    });

    await updateBookStatusForBook(receipt.bookNumber);

    const actorId = req.user?.userId ?? 'unknown';
    await logAuditEvent(actorId, 'RECEIPT_UPDATE', {
      receiptId,
      changes: req.body as unknown as AuditDetails,
    });

    res.status(200).json({ receipt: formatReceipt(updated) });
  } catch (err) {
    logger.error('Update receipt error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteReceipt(
  req: Request<{ receiptId: string }>,
  res: Response
): Promise<void> {
  const { receiptId } = req.params;

  try {
    const receipt = await prisma.sevaReceipt.findUnique({
      where: { id: receiptId },
    });

    if (!receipt) {
      res.status(404).json({ error: 'Receipt not found' });
      return;
    }

    await prisma.sevaReceipt.delete({ where: { id: receiptId } });

    const remainingCount = await prisma.sevaReceipt.count({
      where: { bookNumber: receipt.bookNumber },
    });

    if (remainingCount === 0) {
      const allocation = await prisma.bookAllocation.findUnique({
        where: { bookNumber: receipt.bookNumber },
      });
      if (allocation) {
        await prisma.bookAllocation.update({
          where: { id: allocation.id },
          data: { status: BookStatus.ASSIGNED },
        });
      }
    } else {
      await updateBookStatusForBook(receipt.bookNumber);
    }

    const actorId = req.user?.userId ?? 'unknown';
    await logAuditEvent(actorId, 'RECEIPT_DELETE', { receiptId });

    res.status(200).json({ message: 'Receipt deleted' });
  } catch (err) {
    logger.error('Delete receipt error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}

interface ReceiptUpdateItem {
  receiptId: string;
  receiptNo?: string;
  donorName?: string;
  donorMobile?: string | null;
  amount?: number;
}

interface NewReceiptItem {
  bookNumber: string;
  receiptNo: string;
  donorName: string;
  donorMobile?: string | null;
  amount: number;
  entryDate?: string | null;
}

interface BulkSyncBody {
  sevakId: string;
  updates: ReceiptUpdateItem[];
  additions: NewReceiptItem[];
}

export async function bulkSyncReceipts(
  req: Request<Record<string, never>, unknown, BulkSyncBody>,
  res: Response
): Promise<void> {
  const { sevakId } = req.body;
  const updates = Array.isArray(req.body.updates) ? req.body.updates : [];
  const additions = Array.isArray(req.body.additions) ? req.body.additions : [];

  if (!sevakId?.trim()) {
    res.status(400).json({ error: 'sevakId is required' });
    return;
  }

  if (updates.length === 0 && additions.length === 0) {
    res.status(400).json({ error: 'No updates or additions provided' });
    return;
  }

  try {
    const sevak = await prisma.sevak.findUnique({
      where: { id: sevakId },
      select: { id: true, sevakCode: true, fullName: true, mandal: true },
    });

    if (!sevak) {
      res.status(404).json({ error: 'Sevak not found' });
      return;
    }

    const updateIds = updates.map((u) => u.receiptId);
    const existingForUpdate = await prisma.sevaReceipt.findMany({
      where: { id: { in: updateIds } },
      select: { id: true, sevakId: true, bookNumber: true, receiptNo: true },
    });

    if (existingForUpdate.length !== updates.length) {
      res.status(404).json({ error: 'One or more receipts to update were not found' });
      return;
    }

    const notOwned = existingForUpdate.find((r) => r.sevakId !== sevakId);
    if (notOwned) {
      res.status(403).json({
        error: `Receipt ${notOwned.id} does not belong to this sevak`,
      });
      return;
    }

    const existingById = new Map(existingForUpdate.map((r) => [r.id, r]));
    const normalizedAdditions: Array<
      Omit<Prisma.SevaReceiptCreateManyInput, 'id' | 'createdAt'>
    > = [];
    const requestedKeys = new Map<string, string>();

    for (const add of additions) {
      const bookNumber = add.bookNumber?.trim();
      const receiptNo = add.receiptNo?.trim();
      const donorName = add.donorName?.trim() ?? '';

      if (!bookNumber || !receiptNo) {
        res.status(400).json({
          error: 'Each addition requires bookNumber and receiptNo',
        });
        return;
      }

      const parsed = parseAmount(add.amount);
      if (parsed === null) {
        res.status(400).json({
          error: `Invalid amount for ${bookNumber} / ${receiptNo}`,
        });
        return;
      }

      const donorMobile = add.donorMobile ? normalizeMobile(add.donorMobile) : null;
      if (donorMobile && donorMobile.length < 10) {
        res.status(400).json({
          error: `Invalid donorMobile for ${bookNumber} / ${receiptNo}`,
        });
        return;
      }

      if (requestedKeys.has(receiptNo)) {
        res.status(409).json({
          error: `Duplicate receipt in request: ${receiptNo}`,
        });
        return;
      }
      requestedKeys.set(receiptNo, 'addition');

      const entryDate = parseEntryDate(add.entryDate) ?? new Date();

      normalizedAdditions.push({
        sevakId,
        bookNumber,
        receiptNo,
        donorName,
        donorMobile,
        amount: new Prisma.Decimal(parsed),
        entryDate,
      });
    }

    for (const upd of updates) {
      const current = existingById.get(upd.receiptId);
      if (!current) {
        res.status(400).json({
          error: `Invalid receiptId: ${upd.receiptId}`,
        });
        return;
      }

      const nextBookNumber = current.bookNumber;
      const nextReceiptNo =
        upd.receiptNo !== undefined ? upd.receiptNo.trim() : current.receiptNo;

      if (upd.receiptNo !== undefined && !nextReceiptNo) {
        res.status(400).json({
          error: 'receiptNo is required',
        });
        return;
      }

      if (requestedKeys.has(nextReceiptNo)) {
        res.status(409).json({
          error: `Duplicate receipt in request: ${nextReceiptNo}`,
        });
        return;
      }
      requestedKeys.set(nextReceiptNo, upd.receiptId);

      if (upd.amount !== undefined) {
        const parsed = parseAmount(upd.amount);
        if (parsed === null) {
          res.status(400).json({
            error: `Invalid amount for ${nextBookNumber} / ${nextReceiptNo}`,
          });
          return;
        }
      }

      if (upd.donorMobile !== undefined) {
        const cleaned = upd.donorMobile ? normalizeMobile(upd.donorMobile) : null;
        if (cleaned && cleaned.length < 10) {
          res.status(400).json({
            error: `Invalid donorMobile for ${nextBookNumber} / ${nextReceiptNo}`,
          });
          return;
        }
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const upd of updates) {
        const current = existingById.get(upd.receiptId);
        if (!current) {
          throw new Error(`Receipt not found: ${upd.receiptId}`);
        }

        const data: Prisma.SevaReceiptUpdateInput = {};

        if (upd.receiptNo !== undefined && upd.receiptNo.trim() !== current.receiptNo) {
          const existing = await tx.sevaReceipt.findFirst({
            where: {
              receiptNo: upd.receiptNo.trim(),
              NOT: { id: upd.receiptId },
            },
          });
          if (existing) {
            throw new Error(`Receipt already exists: ${upd.receiptNo.trim()}`);
          }
          data.receiptNo = upd.receiptNo.trim();
        }

        if (upd.donorName !== undefined) {
          data.donorName = upd.donorName.trim();
        }

        if (upd.donorMobile !== undefined) {
          data.donorMobile = upd.donorMobile
            ? normalizeMobile(upd.donorMobile)
            : null;
        }

        if (upd.amount !== undefined) {
          data.amount = new Prisma.Decimal(parseAmount(upd.amount)!);
        }

        if (Object.keys(data).length > 0) {
          await tx.sevaReceipt.update({
            where: { id: upd.receiptId },
            data,
          });
        }
      }

      if (normalizedAdditions.length > 0) {
        const existing = await tx.sevaReceipt.findMany({
          where: {
            receiptNo: { in: [...new Set(normalizedAdditions.map((a) => a.receiptNo))] },
          },
          select: { receiptNo: true },
        });

        if (existing.length > 0) {
          const first = existing[0];
          throw new Error(`Receipt already exists: ${first.receiptNo}`);
        }

        await tx.sevaReceipt.createMany({
          data: normalizedAdditions as Prisma.SevaReceiptCreateManyInput[],
        });
      }

      const affectedBooks = new Set<string>();
      updates.forEach((u) => affectedBooks.add(existingById.get(u.receiptId)!.bookNumber));
      additions.forEach((a) => affectedBooks.add(a.bookNumber.trim()));

      for (const bookNumber of affectedBooks) {
        const receipts = await tx.sevaReceipt.findMany({
          where: { bookNumber },
          select: { receiptNo: true },
        });
        const status = determineBookStatus(receipts);
        const allocation = await tx.bookAllocation.findUnique({
          where: { bookNumber },
        });
        if (allocation && allocation.status !== status) {
          await tx.bookAllocation.update({
            where: { id: allocation.id },
            data: { status },
          });
        }
      }
    });

    const [receipts, books] = await Promise.all([
      prisma.sevaReceipt.findMany({
        where: { sevakId },
        orderBy: [
          { entryDate: 'desc' },
          { bookNumber: 'asc' },
          { receiptNo: 'asc' },
        ],
        include: {
          sevak: { select: { sevakCode: true, fullName: true, mandal: true } },
        },
      }),
      prisma.bookAllocation.findMany({
        where: { sevakId },
        select: { bookNumber: true, status: true, assignedAt: true },
      }),
    ]);

    const bookMap = new Map(
      books.map((b) => [
        b.bookNumber,
        { status: b.status, assignedAt: b.assignedAt.toISOString() },
      ])
    );

    const groups = buildSummaryRows(receipts.map((r) => ({ amount: r.amount })));
    const grandTotal = receipts.reduce((sum, r) => sum + Number(r.amount), 0);
    const totalCount = receipts.length;
    const uniqueBooks = new Set(receipts.map((r) => r.bookNumber)).size;

    const formatted = receipts.map((r) => ({
      ...formatReceipt(r),
      book: bookMap.get(r.bookNumber) ?? null,
    }));

    const actorId = req.user?.userId ?? 'unknown';
    await logAuditEvent(actorId, 'RECEIPTS_BULK_SYNC', {
      sevakId,
      updatedCount: updates.length,
      addedCount: additions.length,
    });

    res.status(200).json({
      sevak,
      receipts: formatted,
      summary: {
        sevak,
        groups,
        grandTotal,
        totalCount,
        uniqueBooks,
      },
    });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Receipt already exists')) {
      res.status(409).json({ error: err.message });
      return;
    }
    if (err instanceof Error && (err.message.includes('Receipt not found') || err.message.includes('Invalid'))) {
      res.status(400).json({ error: err.message });
      return;
    }
    logger.error('Bulk sync receipts error', { error: err });
    res.status(500).json({ error: 'Internal server error' });
  }
}
