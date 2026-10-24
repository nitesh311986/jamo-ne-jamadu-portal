import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import prisma from '../lib/prisma';
import logger from '../utils/logger';
import { logAuditEvent } from '../utils/audit';
import { parsePaginationParams } from '../utils/pagination';
import {
  getPrasadSummaryData,
  sumPrasadItems,
  type PrasadBookRow,
  type PrasadItems,
  type PrasadSummaryFilters,
  type PrasadSummaryTotals,
} from '../services/prasad.service';

class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

function asTrimmedString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function parseFilters(query: Request['query']): PrasadSummaryFilters {
  const status = asTrimmedString(query.status)?.toUpperCase();
  return {
    search: asTrimmedString(query.search),
    sevakCode: asTrimmedString(query.sevakCode),
    sevakName: asTrimmedString(query.sevakName),
    mobile: asTrimmedString(query.mobile),
    sahSevakName: asTrimmedString(query.sahSevakName),
    sahSevakMobile: asTrimmedString(query.sahSevakMobile),
    mandal: asTrimmedString(query.mandal),
    status:
      status === 'PENDING' || status === 'COMPLETED' ? status : 'ALL',
  };
}

function compareBookNumbers(a: string, b: string): number {
  const aNum = Number(a);
  const bNum = Number(b);
  if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
    return aNum - bNum;
  }
  return a.localeCompare(b);
}

function isPendingBook(row: PrasadBookRow): boolean {
  return (
    row.remaining.small > 0 ||
    row.remaining.big > 0 ||
    row.remaining.biscuit > 0 ||
    row.remaining.chocolate > 0
  );
}

function sortPendingBooksFirst(a: PrasadBookRow, b: PrasadBookRow): number {
  const aPending = isPendingBook(a);
  const bPending = isPendingBook(b);

  if (aPending && !bPending) return -1;
  if (!aPending && bPending) return 1;

  return compareBookNumbers(a.bookNumber, b.bookNumber);
}

function computePrasadSummary(rows: PrasadBookRow[]): PrasadSummaryTotals {
  const summary: PrasadSummaryTotals = {
    smallBox: { eligible: 0, given: 0, remaining: 0 },
    bigBox: { eligible: 0, given: 0, remaining: 0 },
    biscuitBox: { eligible: 0, given: 0, remaining: 0 },
    chocolateBox: { eligible: 0, given: 0, remaining: 0 },
  };

  const itemKeys = [
    ['smallBox', 'small'],
    ['bigBox', 'big'],
    ['biscuitBox', 'biscuit'],
    ['chocolateBox', 'chocolate'],
  ] as const;

  for (const row of rows) {
    for (const [totalKey, itemKey] of itemKeys) {
      summary[totalKey].eligible += row.eligible[itemKey];
      summary[totalKey].given += row.distributed[itemKey];
      summary[totalKey].remaining += row.remaining[itemKey];
    }
  }

  return summary;
}

function applySearchScope(rows: PrasadBookRow[], search: string): PrasadBookRow[] {
  if (!search) return rows;

  const q = search.toLowerCase();
  const isNumeric = /^\d+$/.test(search);

  // 1. Exact Book Number match (strict to this book only)
  const bookMatches = rows.filter((row) => row.bookNumber.toLowerCase() === q);
  if (bookMatches.length > 0) return bookMatches;

  // 2. Sah-Sevak Name or Mobile match (strict to this book)
  const sahMatches = rows.filter(
    (row) =>
      (row.sahSevakName && row.sahSevakName.toLowerCase().includes(q)) ||
      (row.sahSevakMobile && row.sahSevakMobile.includes(search))
  );
  if (sahMatches.length > 0) return sahMatches;

  // 3. Receipt Number match (strict to this book)
  const receiptMatches = rows.filter((row) =>
    row.receiptNos.some(
      (no) =>
        no === search ||
        (isNumeric && !Number.isNaN(Number(no)) && Number(no) === Number(search))
    )
  );
  if (receiptMatches.length > 0) return receiptMatches;

  // 4. Sevak Code, Name or Mobile (show all books for the matched Sevak)
  return rows.filter(
    (row) =>
      row.sevakCode.toLowerCase().includes(q) ||
      row.sevakName.toLowerCase().includes(q) ||
      row.sevakMobile.includes(search)
  );
}

export async function getPrasadSummary(req: Request, res: Response): Promise<void> {
  try {
    const filters = parseFilters(req.query);
    const { page, limit, skip, take } = parsePaginationParams(req.query);
    const trimmedSearch = (req.query.search as string || '').trim();

    const { rows: allRows, mandals } = await getPrasadSummaryData(filters);

    const scopedRows = trimmedSearch ? applySearchScope(allRows, trimmedSearch) : allRows;
    scopedRows.sort(sortPendingBooksFirst);

    const summary = computePrasadSummary(scopedRows);

    const totalCount = scopedRows.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    const data = scopedRows.slice(skip, skip + take);

    res.status(200).json({
      success: true,
      data,
      summary,
      mandals,
      pagination: {
        totalCount,
        totalPages,
        currentPage: page,
        pageSize: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    logger.error('Get prasad summary error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}

interface DistributeBody {
  sevakId: string;
  bookNumber: string;
  distributedSmall?: number;
  distributedBig?: number;
  distributedBiscuit?: number;
  distributedChocolate?: number;
  collectedByName?: string;
  collectedByMobile?: string;
  notes?: string;
}

const ITEM_FIELDS = [
  { bodyKey: 'distributedSmall', itemKey: 'small', label: 'Small Box' },
  { bodyKey: 'distributedBig', itemKey: 'big', label: 'Big Box' },
  { bodyKey: 'distributedBiscuit', itemKey: 'biscuit', label: 'Biscuit Box' },
  { bodyKey: 'distributedChocolate', itemKey: 'chocolate', label: 'Chocolate Box' },
] as const;

function parseQuantity(value: unknown, label: string): number {
  if (value === undefined || value === null) return 0;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new HttpError(400, `${label} quantity must be a non-negative integer`);
  }
  return value;
}

function normalizeMobile(value: string | undefined | null): string {
  return (value ?? '').replace(/\D/g, '');
}

export async function distributePrasad(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as DistributeBody;

    const sevakId = asTrimmedString(body?.sevakId);
    const bookNumber = asTrimmedString(body?.bookNumber);
    if (!sevakId || !bookNumber) {
      res.status(400).json({ success: false, error: 'sevakId and bookNumber are required' });
      return;
    }

    const issue: PrasadItems = {
      small: parseQuantity(body.distributedSmall, 'Small Box'),
      big: parseQuantity(body.distributedBig, 'Big Box'),
      biscuit: parseQuantity(body.distributedBiscuit, 'Biscuit Box'),
      chocolate: parseQuantity(body.distributedChocolate, 'Chocolate Box'),
    };

    if (issue.small + issue.big + issue.biscuit + issue.chocolate === 0) {
      res
        .status(400)
        .json({ success: false, error: 'At least one item quantity must be greater than zero' });
      return;
    }

    const collectedByName = asTrimmedString(body.collectedByName) ?? null;
    const collectedByMobileRaw = asTrimmedString(body.collectedByMobile) ?? null;
    if (collectedByMobileRaw && normalizeMobile(collectedByMobileRaw).length < 10) {
      res
        .status(400)
        .json({ success: false, error: 'Collected-by mobile must contain at least 10 digits' });
      return;
    }
    const notes = asTrimmedString(body.notes) ?? null;
    const distributedBy = req.user?.fullName ?? req.user?.email ?? 'unknown';
    const now = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const sevak = await tx.sevak.findUnique({ where: { id: sevakId } });
      if (!sevak) {
        throw new HttpError(404, 'Sevak not found');
      }

      const book = await tx.bookAllocation.findFirst({
        where: { sevakId, bookNumber },
      });
      if (!book) {
        throw new HttpError(404, `Book ${bookNumber} is not allocated to this sevak`);
      }

      const receipts = await tx.sevaReceipt.findMany({
        where: { sevakId, bookNumber },
        select: { amount: true },
      });
      const eligible = sumPrasadItems(receipts.map((r) => r.amount.toNumber()));

      const existing = await tx.prasadDistribution.findUnique({
        where: { sevakId_bookNumber: { sevakId, bookNumber } },
      });
      const alreadyGiven: PrasadItems = {
        small: existing?.distributedSmall ?? 0,
        big: existing?.distributedBig ?? 0,
        biscuit: existing?.distributedBiscuit ?? 0,
        chocolate: existing?.distributedChocolate ?? 0,
      };

      for (const field of ITEM_FIELDS) {
        const requested = issue[field.itemKey];
        const remainingFor = eligible[field.itemKey] - alreadyGiven[field.itemKey];
        if (requested > remainingFor) {
          throw new HttpError(
            400,
            `Cannot distribute ${requested} ${field.label}(s). Only ${Math.max(0, remainingFor)} remaining for this book.`
          );
        }
      }

      return tx.prasadDistribution.upsert({
        where: { sevakId_bookNumber: { sevakId, bookNumber } },
        update: {
          eligibleSmall: eligible.small,
          eligibleBig: eligible.big,
          eligibleBiscuit: eligible.biscuit,
          eligibleChocolate: eligible.chocolate,
          distributedSmall: { increment: issue.small },
          distributedBig: { increment: issue.big },
          distributedBiscuit: { increment: issue.biscuit },
          distributedChocolate: { increment: issue.chocolate },
          collectedByName,
          collectedByMobile: collectedByMobileRaw,
          notes,
          distributedAt: now,
          distributedBy,
        },
        create: {
          sevakId,
          bookNumber,
          eligibleSmall: eligible.small,
          eligibleBig: eligible.big,
          eligibleBiscuit: eligible.biscuit,
          eligibleChocolate: eligible.chocolate,
          distributedSmall: issue.small,
          distributedBig: issue.big,
          distributedBiscuit: issue.biscuit,
          distributedChocolate: issue.chocolate,
          collectedByName,
          collectedByMobile: collectedByMobileRaw,
          notes,
          distributedAt: now,
          distributedBy,
        },
      });
    });

    const actorId = req.user?.userId ?? 'unknown';
    await logAuditEvent(actorId, 'PRASAD_DISTRIBUTE', {
      sevakId,
      bookNumber,
      distributedSmall: issue.small,
      distributedBig: issue.big,
      distributedBiscuit: issue.biscuit,
      distributedChocolate: issue.chocolate,
      collectedByName,
      collectedByMobile: collectedByMobileRaw,
    });

    logger.info('Prasad distributed', {
      userId: actorId,
      sevakId,
      bookNumber,
      issue,
    });

    res.status(200).json({
      success: true,
      message: 'Prasad distributed successfully',
      data: updated,
    });
  } catch (err) {
    if (err instanceof HttpError) {
      res.status(err.status).json({ success: false, error: err.message });
      return;
    }
    logger.error('Distribute prasad error', {
      error: (err as Error).message,
      stack: (err as Error).stack,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function exportPrasadExcel(req: Request, res: Response): Promise<void> {
  try {
    const filters = parseFilters(req.query);
    const { rows } = await getPrasadSummaryData(filters);
    const trimmedSearch = (req.query.search as string || '').trim();

    const scopedRows = trimmedSearch ? applySearchScope(rows, trimmedSearch) : [...rows];
    scopedRows.sort(sortPendingBooksFirst);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Prasad Vitran');

    worksheet.columns = [
      { header: 'Sevak Code', key: 'sevakCode', width: 14 },
      { header: 'Sevak Name', key: 'sevakName', width: 28 },
      { header: 'Sevak Mobile', key: 'sevakMobile', width: 16 },
      { header: 'Mandal', key: 'mandal', width: 18 },
      { header: 'Book Number', key: 'bookNumber', width: 14 },
      { header: 'Sah-Sevak Name', key: 'sahSevakName', width: 26 },
      { header: 'Sah-Sevak Mobile', key: 'sahSevakMobile', width: 18 },
      { header: 'Small Box (Eligible / Given / Remaining)', key: 'smallBox', width: 26 },
      { header: 'Big Box (Eligible / Given / Remaining)', key: 'bigBox', width: 26 },
      { header: 'Biscuit Box (Eligible / Given / Remaining)', key: 'biscuitBox', width: 26 },
      { header: 'Chocolate Box (Eligible / Given / Remaining)', key: 'chocolateBox', width: 28 },
      { header: 'Picked Up By (Name)', key: 'collectedByName', width: 26 },
      { header: 'Picked Up By (Mobile)', key: 'collectedByMobile', width: 20 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Dispensed By (Volunteer)', key: 'distributedBy', width: 24 },
      { header: 'Dispensed At (Date & Time)', key: 'distributedAt', width: 24 },
    ];

    const saffronFill: Partial<ExcelJS.Fill> = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF9933' },
    };
    const navyFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: '000080' } };

    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = saffronFill as ExcelJS.Fill;
      cell.font = navyFont as ExcelJS.Font;
      cell.alignment = { horizontal: 'center', wrapText: true };
    });

    const formatItem = (eligible: number, given: number, remaining: number): string =>
      `${eligible} / ${given} / ${remaining}`;

    worksheet.addRows(
      scopedRows.map((row) => ({
        sevakCode: row.sevakCode,
        sevakName: row.sevakName,
        sevakMobile: row.sevakMobile,
        mandal: row.mandal,
        bookNumber: row.bookNumber,
        sahSevakName: row.sahSevakName ?? '',
        sahSevakMobile: row.sahSevakMobile ?? '',
        smallBox: formatItem(row.eligible.small, row.distributed.small, row.remaining.small),
        bigBox: formatItem(row.eligible.big, row.distributed.big, row.remaining.big),
        biscuitBox: formatItem(row.eligible.biscuit, row.distributed.biscuit, row.remaining.biscuit),
        chocolateBox: formatItem(
          row.eligible.chocolate,
          row.distributed.chocolate,
          row.remaining.chocolate
        ),
        collectedByName: row.collectedByName ?? '',
        collectedByMobile: row.collectedByMobile ?? '',
        status: row.status === 'COMPLETED' ? 'Completed' : 'Pending',
        distributedBy: row.distributedBy ?? '',
        distributedAt: row.distributedAt
          ? new Date(row.distributedAt).toLocaleString('en-IN')
          : '',
      }))
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="Prasad_Vitran_Records_2026.xlsx"'
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    logger.error('Export prasad records error', { error: (err as Error).message });
    res.status(500).json({ error: 'Internal server error' });
  }
}
