import { BookStatus, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';

export interface PrasadItems {
  bag: number;
  small: number;
  big: number;
  biscuit: number;
  chocolate: number;
}

export interface PrasadSlabCounts {
  slab1: number; // ₹1 - ₹249
  slab2: number; // ₹250 - ₹499
  slab3: number; // ₹500 - ₹1,000
  slab4: number; // ₹1,001 - ₹4,999
  slab5: number; // ₹5,000 - ₹20,000+
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
    label: '₹1 - ₹249',
    min: 1,
    max: 249,
    items: { bag: 1, small: 0, big: 0, biscuit: 0, chocolate: 0 },
  },
  {
    key: 'SLAB_2',
    label: '₹250 - ₹499',
    min: 250,
    max: 499,
    items: { bag: 0, small: 1, big: 0, biscuit: 0, chocolate: 0 },
  },
  {
    key: 'SLAB_3',
    label: '₹500 - ₹1,000',
    min: 500,
    max: 1000,
    items: { bag: 0, small: 0, big: 1, biscuit: 0, chocolate: 0 },
  },
  {
    key: 'SLAB_4',
    label: '₹1,001 - ₹4,999',
    min: 1001,
    max: 4999,
    items: { bag: 0, small: 0, big: 1, biscuit: 1, chocolate: 0 },
  },
  {
    key: 'SLAB_5',
    label: '₹5,000 - ₹20,000+',
    min: 5000,
    max: null,
    items: { bag: 0, small: 0, big: 1, biscuit: 1, chocolate: 1 },
  },
];

const SLAB_COUNT_KEYS = ['slab1', 'slab2', 'slab3', 'slab4', 'slab5'] as const;

function emptyPrasadItems(): PrasadItems {
  return { bag: 0, small: 0, big: 0, biscuit: 0, chocolate: 0 };
}

export function computePrasadItems(amount: number): PrasadItems {
  if (!Number.isFinite(amount) || amount < 1) {
    return emptyPrasadItems();
  }
  for (const slab of SLAB_DEFS) {
    const withinMax = slab.max === null || amount <= slab.max;
    if (amount >= slab.min && withinMax) {
      return { ...slab.items };
    }
  }
  return emptyPrasadItems();
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

function toAmountNumber(amount: Prisma.Decimal | number): number {
  return typeof amount === 'number' ? amount : amount.toNumber();
}

export function calculatePrasadForReceipts(
  receipts: Array<{ amount: number | Prisma.Decimal }>
): { eligible: PrasadItems; slabCounts: PrasadSlabCounts } {
  const eligible = emptyPrasadItems();
  const slabCounts: PrasadSlabCounts = {
    slab1: 0,
    slab2: 0,
    slab3: 0,
    slab4: 0,
    slab5: 0,
  };

  for (const r of receipts) {
    const amt = toAmountNumber(r.amount);
    const slabIndex = SLAB_DEFS.findIndex(
      (slab) => amt >= slab.min && (slab.max === null || amt <= slab.max)
    );
    if (slabIndex === -1) continue;

    const items = SLAB_DEFS[slabIndex].items;
    eligible.bag += items.bag;
    eligible.small += items.small;
    eligible.big += items.big;
    eligible.biscuit += items.biscuit;
    eligible.chocolate += items.chocolate;
    slabCounts[SLAB_COUNT_KEYS[slabIndex]] += 1;
  }

  return { eligible, slabCounts };
}

export function sumPrasadItems(amounts: number[]): PrasadItems {
  return calculatePrasadForReceipts(amounts.map((amount) => ({ amount }))).eligible;
}

export interface SlabBreakdown {
  receiptCount: number;
  bag: number;
  small: number;
  big: number;
  biscuit: number;
  chocolate: number;
}

export interface SevakSlabSummary {
  totalReceipts: number;
  totalAmount: number;
  booksCount: number;
  sahSevakNames: string[];
  slab1: SlabBreakdown;
  slab2: SlabBreakdown;
  slab3: SlabBreakdown;
  slab4: SlabBreakdown;
  slab5: SlabBreakdown;
  totalEligible: PrasadItems;
}

function emptySlabBreakdown(): SlabBreakdown {
  return { receiptCount: 0, bag: 0, small: 0, big: 0, biscuit: 0, chocolate: 0 };
}

export function buildSevakSlabSummary(
  receipts: Array<{ amount: number | Prisma.Decimal; bookNumber?: string }>,
  booksCount: number,
  sahSevakNames: string[]
): SevakSlabSummary {
  const breakdowns = SLAB_DEFS.map(() => emptySlabBreakdown());
  let totalAmount = 0;

  for (const r of receipts) {
    const amt = toAmountNumber(r.amount);
    totalAmount += amt;
    const slabIndex = SLAB_DEFS.findIndex(
      (slab) => amt >= slab.min && (slab.max === null || amt <= slab.max)
    );
    if (slabIndex === -1) continue;

    const items = SLAB_DEFS[slabIndex].items;
    const breakdown = breakdowns[slabIndex];
    breakdown.receiptCount += 1;
    breakdown.bag += items.bag;
    breakdown.small += items.small;
    breakdown.big += items.big;
    breakdown.biscuit += items.biscuit;
    breakdown.chocolate += items.chocolate;
  }

  const totalEligible = breakdowns.reduce<PrasadItems>(
    (acc, b) => ({
      bag: acc.bag + b.bag,
      small: acc.small + b.small,
      big: acc.big + b.big,
      biscuit: acc.biscuit + b.biscuit,
      chocolate: acc.chocolate + b.chocolate,
    }),
    emptyPrasadItems()
  );

  return {
    totalReceipts: receipts.length,
    totalAmount,
    booksCount,
    sahSevakNames,
    slab1: breakdowns[0],
    slab2: breakdowns[1],
    slab3: breakdowns[2],
    slab4: breakdowns[3],
    slab5: breakdowns[4],
    totalEligible,
  };
}

export interface SevakSlabSummaryData {
  sevak: {
    id: string;
    sevakCode: string;
    fullName: string;
    mobile: string;
    mandal: string;
    kshetra: string;
  };
  slabSummary: SevakSlabSummary;
}

export async function getSevakSlabSummaryData(
  sevakId: string
): Promise<SevakSlabSummaryData | null> {
  const sevak = await prisma.sevak.findUnique({
    where: { id: sevakId },
    include: {
      assignedBooks: true,
      receipts: { select: { amount: true, bookNumber: true } },
    },
  });
  if (!sevak) return null;

  const bookNumbers = new Set(sevak.assignedBooks.map((b) => b.bookNumber));
  const bookReceipts = sevak.receipts.filter((r) => bookNumbers.has(r.bookNumber));

  const sahSevakNames = [
    ...new Set(
      sevak.assignedBooks
        .map((b) => b.sahSevakName?.trim())
        .filter((name): name is string => Boolean(name))
    ),
  ];

  return {
    sevak: {
      id: sevak.id,
      sevakCode: sevak.sevakCode,
      fullName: sevak.fullName,
      mobile: sevak.mobile,
      mandal: sevak.mandal,
      kshetra: sevak.kshetra,
    },
    slabSummary: buildSevakSlabSummary(
      bookReceipts,
      sevak.assignedBooks.length,
      sahSevakNames
    ),
  };
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
  extra: PrasadItems;
  remaining: PrasadItems;
  slabCounts: PrasadSlabCounts;
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
  bag: PrasadItemTotals;
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
  const { eligible, slabCounts } = calculatePrasadForReceipts(bookReceipts);

  const distribution = sevak.distributions.find((d) => d.bookNumber === book.bookNumber);
  const distributed: PrasadItems = {
    bag: distribution?.distributedBag ?? 0,
    small: distribution?.distributedSmall ?? 0,
    big: distribution?.distributedBig ?? 0,
    biscuit: distribution?.distributedBiscuit ?? 0,
    chocolate: distribution?.distributedChocolate ?? 0,
  };
  const extra: PrasadItems = {
    bag: distribution?.extraBag ?? 0,
    small: distribution?.extraSmall ?? 0,
    big: distribution?.extraBig ?? 0,
    biscuit: distribution?.extraBiscuit ?? 0,
    chocolate: distribution?.extraChocolate ?? 0,
  };

  const remaining: PrasadItems = {
    bag: Math.max(0, eligible.bag - distributed.bag),
    small: Math.max(0, eligible.small - distributed.small),
    big: Math.max(0, eligible.big - distributed.big),
    biscuit: Math.max(0, eligible.biscuit - distributed.biscuit),
    chocolate: Math.max(0, eligible.chocolate - distributed.chocolate),
  };

  const status: PrasadRowStatus =
    remaining.bag +
      remaining.small +
      remaining.big +
      remaining.biscuit +
      remaining.chocolate ===
    0
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
    extra,
    remaining,
    slabCounts,
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
    bag: { eligible: 0, given: 0, remaining: 0 },
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
    ['bag', 'bag'],
    ['smallBox', 'small'],
    ['bigBox', 'big'],
    ['biscuitBox', 'biscuit'],
    ['chocolateBox', 'chocolate'],
  ] as const;

  for (const row of filteredRows) {
    for (const [totalKey, itemKey] of itemKeys) {
      summary[totalKey].eligible += row.eligible[itemKey];
      summary[totalKey].given += row.distributed[itemKey] + row.extra[itemKey];
      summary[totalKey].remaining += row.remaining[itemKey];
    }
  }

  return {
    rows: filteredRows,
    summary,
    mandals: mandalRows.map((m) => m.mandal),
  };
}
