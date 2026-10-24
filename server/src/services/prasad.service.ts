import { BookStatus, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

export interface PrasadItems {
  small: number;
  big: number;
  biscuit: number;
  chocolate: number;
}

export interface SlabDefinition {
  key: string;
  label: string;
  min: number;
  max: number | null;
  items: PrasadItems;
}

// Mandir slab rules applied per receipt amount.
export const SLAB_DEFS: SlabDefinition[] = [
  {
    key: 'SLAB_1',
    label: '₹1 - ₹499',
    min: 1,
    max: 499.99,
    items: { small: 1, big: 0, biscuit: 0, chocolate: 0 },
  },
  {
    key: 'SLAB_2',
    label: '₹500 - ₹1,000',
    min: 500,
    max: 1000,
    items: { small: 0, big: 1, biscuit: 0, chocolate: 0 },
  },
  {
    key: 'SLAB_3',
    label: '₹1,001 - ₹4,999',
    min: 1000.01,
    max: 4999.99,
    items: { small: 0, big: 1, biscuit: 1, chocolate: 0 },
  },
  {
    key: 'SLAB_4',
    label: '₹5,000+',
    min: 5000,
    max: null,
    items: { small: 0, big: 1, biscuit: 1, chocolate: 1 },
  },
];

export function computePrasadItems(amount: number): PrasadItems {
  if (!Number.isFinite(amount) || amount < 1) {
    return { small: 0, big: 0, biscuit: 0, chocolate: 0 };
  }
  for (const slab of SLAB_DEFS) {
    const withinMax = slab.max === null || amount <= slab.max;
    if (amount >= slab.min && withinMax) {
      return { ...slab.items };
    }
  }
  return { small: 0, big: 0, biscuit: 0, chocolate: 0 };
}

export function classifySlabLabel(amount: number): string {
  for (const slab of SLAB_DEFS) {
    const withinMax = slab.max === null || amount <= slab.max;
    if (amount >= slab.min && withinMax) {
      return slab.label;
    }
  }
  return '< ₹1';
}

export function sumPrasadItems(amounts: number[]): PrasadItems {
  const total: PrasadItems = { small: 0, big: 0, biscuit: 0, chocolate: 0 };
  for (const amount of amounts) {
    const items = computePrasadItems(amount);
    total.small += items.small;
    total.big += items.big;
    total.biscuit += items.biscuit;
    total.chocolate += items.chocolate;
  }
  return total;
}

export type PrasadRowStatus = 'PENDING' | 'COMPLETED';

export interface PrasadBookRow {
  sevakId: string;
  sevakCode: string;
  sevakName: string;
  sevakMobile: string;
  mandal: string;
  kshetra: string;
  bookNumber: string;
  bookStatus: BookStatus;
  sahSevakName: string | null;
  sahSevakMobile: string | null;
  receiptCount: number;
  receiptNos: string[];
  eligible: PrasadItems;
  distributed: PrasadItems;
  remaining: PrasadItems;
  collectedByName: string | null;
  collectedByMobile: string | null;
  distributedBy: string | null;
  distributedAt: string | null;
  notes: string | null;
  status: PrasadRowStatus;
}

export interface PrasadItemTotals {
  eligible: number;
  given: number;
  remaining: number;
}

export interface PrasadSummaryTotals {
  smallBox: PrasadItemTotals;
  bigBox: PrasadItemTotals;
  biscuitBox: PrasadItemTotals;
  chocolateBox: PrasadItemTotals;
}

export interface PrasadSummaryFilters {
  search?: string;
  sevakCode?: string;
  sevakName?: string;
  mobile?: string;
  sahSevakName?: string;
  sahSevakMobile?: string;
  mandal?: string;
  status?: 'ALL' | 'PENDING' | 'COMPLETED';
}

export interface PrasadSummaryData {
  rows: PrasadBookRow[];
  summary: PrasadSummaryTotals;
  mandals: string[];
}

function toAmountNumber(amount: Prisma.Decimal | number): number {
  return typeof amount === 'number' ? amount : amount.toNumber();
}

export function buildSevakWhere(filters: PrasadSummaryFilters): Prisma.SevakWhereInput {
  const and: Prisma.SevakWhereInput[] = [];

  if (filters.search) {
    and.push({
      OR: [
        { sevakCode: { contains: filters.search, mode: 'insensitive' } },
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { mobile: { contains: filters.search } },
        { altMobile: { contains: filters.search } },
        {
          assignedBooks: {
            some: {
              OR: [
                { bookNumber: { equals: filters.search } },
                { sahSevakName: { contains: filters.search, mode: 'insensitive' } },
                { sahSevakMobile: { contains: filters.search } },
              ],
            },
          },
        },
        {
          receipts: {
            some: {
              receiptNo: { contains: filters.search },
            },
          },
        },
      ],
    });
  }

  if (filters.sevakCode) {
    and.push({ sevakCode: { contains: filters.sevakCode, mode: 'insensitive' } });
  }
  if (filters.sevakName) {
    and.push({ fullName: { contains: filters.sevakName, mode: 'insensitive' } });
  }
  if (filters.mobile) {
    and.push({
      OR: [{ mobile: { contains: filters.mobile } }, { altMobile: { contains: filters.mobile } }],
    });
  }
  if (filters.mandal) {
    and.push({ mandal: { equals: filters.mandal, mode: 'insensitive' } });
  }
  if (filters.sahSevakName) {
    and.push({
      assignedBooks: {
        some: { sahSevakName: { contains: filters.sahSevakName, mode: 'insensitive' } },
      },
    });
  }
  if (filters.sahSevakMobile) {
    and.push({
      assignedBooks: {
        some: { sahSevakMobile: { contains: filters.sahSevakMobile } },
      },
    });
  }

  return and.length > 0 ? { AND: and } : {};
}

function compareBookNumbers(a: string, b: string): number {
  const aNum = Number(a);
  const bNum = Number(b);
  if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
    return aNum - bNum;
  }
  return a.localeCompare(b);
}

type SevakWithPrasadData = Prisma.SevakGetPayload<{
  include: { assignedBooks: true; receipts: true; distributions: true };
}>;

function buildBookRow(sevak: SevakWithPrasadData, book: SevakWithPrasadData['assignedBooks'][number]): PrasadBookRow {
  const bookReceipts = sevak.receipts.filter((r) => r.bookNumber === book.bookNumber);
  const eligible = sumPrasadItems(bookReceipts.map((r) => toAmountNumber(r.amount)));

  const distribution = sevak.distributions.find((d) => d.bookNumber === book.bookNumber);
  const distributed: PrasadItems = {
    small: distribution?.distributedSmall ?? 0,
    big: distribution?.distributedBig ?? 0,
    biscuit: distribution?.distributedBiscuit ?? 0,
    chocolate: distribution?.distributedChocolate ?? 0,
  };

  const remaining: PrasadItems = {
    small: Math.max(0, eligible.small - distributed.small),
    big: Math.max(0, eligible.big - distributed.big),
    biscuit: Math.max(0, eligible.biscuit - distributed.biscuit),
    chocolate: Math.max(0, eligible.chocolate - distributed.chocolate),
  };

  const status: PrasadRowStatus =
    remaining.small + remaining.big + remaining.biscuit + remaining.chocolate === 0
      ? 'COMPLETED'
      : 'PENDING';

  return {
    sevakId: sevak.id,
    sevakCode: sevak.sevakCode,
    sevakName: sevak.fullName,
    sevakMobile: sevak.mobile,
    mandal: sevak.mandal,
    kshetra: sevak.kshetra,
    bookNumber: book.bookNumber,
    bookStatus: book.status,
    sahSevakName: book.sahSevakName,
    sahSevakMobile: book.sahSevakMobile,
    receiptCount: bookReceipts.length,
    receiptNos: bookReceipts.map((r) => r.receiptNo),
    eligible,
    distributed,
    remaining,
    collectedByName: distribution?.collectedByName ?? null,
    collectedByMobile: distribution?.collectedByMobile ?? null,
    distributedBy: distribution?.distributedBy ?? null,
    distributedAt: distribution?.distributedAt
      ? distribution.distributedAt.toISOString()
      : null,
    notes: distribution?.notes ?? null,
    status,
  };
}

function emptyTotals(): PrasadSummaryTotals {
  return {
    smallBox: { eligible: 0, given: 0, remaining: 0 },
    bigBox: { eligible: 0, given: 0, remaining: 0 },
    biscuitBox: { eligible: 0, given: 0, remaining: 0 },
    chocolateBox: { eligible: 0, given: 0, remaining: 0 },
  };
}

export async function getPrasadSummaryData(
  filters: PrasadSummaryFilters
): Promise<PrasadSummaryData> {
  const where = buildSevakWhere(filters);

  const [sevaks, mandalRows] = await Promise.all([
    prisma.sevak.findMany({
      where,
      include: { assignedBooks: true, receipts: true, distributions: true },
      orderBy: { sevakCode: 'asc' },
    }),
    prisma.sevak.findMany({
      select: { mandal: true },
      distinct: ['mandal'],
      orderBy: { mandal: 'asc' },
    }),
  ]);

  const rows: PrasadBookRow[] = [];
  for (const sevak of sevaks) {
    const sortedBooks = [...sevak.assignedBooks].sort((a, b) =>
      compareBookNumbers(a.bookNumber, b.bookNumber)
    );
    for (const book of sortedBooks) {
      rows.push(buildBookRow(sevak, book));
    }
  }

  const statusFilter = filters.status ?? 'ALL';
  const filteredRows =
    statusFilter === 'ALL' ? rows : rows.filter((r) => r.status === statusFilter);

  const summary = emptyTotals();
  const itemKeys = [
    ['smallBox', 'small'],
    ['bigBox', 'big'],
    ['biscuitBox', 'biscuit'],
    ['chocolateBox', 'chocolate'],
  ] as const;

  for (const row of filteredRows) {
    for (const [totalKey, itemKey] of itemKeys) {
      summary[totalKey].eligible += row.eligible[itemKey];
      summary[totalKey].given += row.distributed[itemKey];
      summary[totalKey].remaining += row.remaining[itemKey];
    }
  }

  return {
    rows: filteredRows,
    summary,
    mandals: mandalRows.map((m) => m.mandal),
  };
}
