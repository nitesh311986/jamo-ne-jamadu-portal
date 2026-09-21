import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import prisma from '../lib/prisma';
import { logAuditEvent } from '../utils/audit';
import logger from '../utils/logger';

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
    if (!item.donorName?.trim()) {
      throw new Error(`Receipt at index ${i} is missing donorName`);
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
    const key = `${bookNumber}|${receiptNo}`;

    if (seen.has(key)) {
      throw new Error(`Duplicate receipt in request: ${bookNumber} / ${receiptNo}`);
    }
    seen.add(key);

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
        OR: data.map((d) => ({
          AND: [{ bookNumber: d.bookNumber }, { receiptNo: d.receiptNo }],
        })),
      },
    });

    if (existing.length > 0) {
      const first = existing[0];
      res.status(409).json({
        error: `Receipt already exists: ${first.bookNumber} / ${first.receiptNo}`,
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
  const rawPage = parseInt(String(req.query.page ?? '1'), 10);
  const rawLimit = parseInt(String(req.query.limit ?? '20'), 10);
  const page = Math.max(1, Number.isNaN(rawPage) ? 1 : rawPage);
  const limit = Math.max(1, Math.min(100, Number.isNaN(rawLimit) ? 20 : rawLimit));
  const skip = (page - 1) * limit;

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
    const [receipts, total] = await Promise.all([
      prisma.sevaReceipt.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sevak: { select: { sevakCode: true, fullName: true, mandal: true } },
        },
      }),
      prisma.sevaReceipt.count({ where }),
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
