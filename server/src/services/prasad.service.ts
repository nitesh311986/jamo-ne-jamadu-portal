import { BookStatus } from '@prisma/client';
import prisma from '../lib/prisma';

export interface TierDefinition {
  key: string;
  label: string;
  min: number;
  max: number | null;
  oneBoxPerUniqueAmount: boolean;
}

export const TIER_DEFS: TierDefinition[] = [
  { key: 'LT_500', label: '< ₹500', min: 0, max: 499.99, oneBoxPerUniqueAmount: true },
  { key: 'GTE_500_LT_1000', label: '₹500 - ₹999', min: 500, max: 999.99, oneBoxPerUniqueAmount: false },
  { key: 'GTE_1000_LT_2000', label: '₹1,000 - ₹1,999', min: 1000, max: 1999.99, oneBoxPerUniqueAmount: false },
  { key: 'GTE_2000_LT_5000', label: '₹2,000 - ₹4,999', min: 2000, max: 4999.99, oneBoxPerUniqueAmount: false },
  { key: 'GTE_5000_LT_10000', label: '₹5,000 - ₹9,999', min: 5000, max: 9999.99, oneBoxPerUniqueAmount: false },
  { key: 'GTE_10000_LT_25000', label: '₹10,000 - ₹24,999', min: 10000, max: 24999.99, oneBoxPerUniqueAmount: false },
  { key: 'GTE_25000_LT_50000', label: '₹25,000 - ₹49,999', min: 25000, max: 49999.99, oneBoxPerUniqueAmount: false },
  { key: 'GTE_50000', label: '≥ ₹50,000', min: 50000, max: null, oneBoxPerUniqueAmount: false },
];

export function classifyTier(amount: number): TierDefinition {
  for (const tier of TIER_DEFS) {
    if (tier.max === null) {
      if (amount >= tier.min) return tier;
    } else if (amount >= tier.min && amount <= tier.max) {
      return tier;
    }
  }
  return TIER_DEFS[0];
}

export interface DistributionReceipt {
  id: string;
  receiptNo: string;
  donorName: string | null;
  amount: number;
  prasadDistributed: boolean;
  distributedAt: string | null;
  boxesGenerated: number;
}

export interface BookGroup {
  bookNumber: string;
  status: BookStatus;
  assignedAt: string;
  receipts: DistributionReceipt[];
}

export interface TierBreakdown {
  slabTier: string;
  tierLabel: string;
  minAmount: number;
  maxAmount: number | null;
  totalReceipts: number;
  unservedReceipts: number;
  eligibleBoxes: number;
  distributedBoxes: number;
  remainingBoxes: number;
}

export interface DistributionOverview {
  sevak: {
    id: string;
    sevakCode: string;
    fullName: string;
    firstName: string;
    lastName: string;
    mobile: string;
    altMobile: string | null;
    whatsapp: string | null;
    address: string;
    mandal: string;
    kshetra: string;
    expectedContacts: number;
  };
  books: {
    total: number;
    completed: number;
    partially: number;
    pending: number;
  };
  receipts: {
    total: number;
    served: number;
    unserved: number;
  };
  tiers: TierBreakdown[];
  grandTotal: {
    totalSevaAmount: number;
    eligibleBoxes: number;
    distributedBoxes: number;
    pendingBoxes: number;
  };
  receiptsByBook: BookGroup[];
}

function toINR(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildOverview(
  sevak: {
    id: string;
    sevakCode: string;
    fullName: string;
    firstName: string;
    lastName: string;
    mobile: string;
    altMobile: string | null;
    whatsapp: string | null;
    address: string;
    mandal: string;
    kshetra: string;
    expectedContacts: number;
  },
  receipts: Array<{
    id: string;
    bookNumber: string;
    receiptNo: string;
    donorName: string | null;
    amount: { toNumber: () => number } | number;
    prasadDistributed: boolean;
    distributedAt: Date | null;
    entryDate: Date;
  }>,
  distributions: Array<{ slabTier: string; distributedBoxes: number }>,
  books: Array<{ bookNumber: string; status: BookStatus; assignedAt: Date }>
): DistributionOverview {
  const normalizedReceipts = receipts
    .map((r) => ({
      ...r,
      amountNum: typeof r.amount === 'number' ? r.amount : r.amount.toNumber(),
    }))
    .sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime());

  const totalSevaAmount = normalizedReceipts.reduce((sum, r) => sum + r.amountNum, 0);
  const totalReceipts = normalizedReceipts.length;
  const servedReceipts = normalizedReceipts.filter((r) => r.prasadDistributed).length;
  const unservedReceipts = totalReceipts - servedReceipts;

  const tierLookup: Record<string, TierBreakdown> = {};
  for (const def of TIER_DEFS) {
    const tierReceipts = normalizedReceipts.filter((r) => {
      const t = classifyTier(r.amountNum);
      return t.key === def.key;
    });

    const totalInTier = tierReceipts.length;
    const unservedInTier = tierReceipts.filter((r) => !r.prasadDistributed).length;

    let eligibleBoxes = 0;
    if (def.oneBoxPerUniqueAmount) {
      const uniqueAmounts = new Set(tierReceipts.map((r) => r.amountNum));
      eligibleBoxes = uniqueAmounts.size;
    } else {
      eligibleBoxes = totalInTier;
    }

    const distRow = distributions.find((d) => d.slabTier === def.key);
    const distributedBoxes = distRow?.distributedBoxes ?? 0;
    const remainingBoxes = Math.max(0, eligibleBoxes - distributedBoxes);

    tierLookup[def.key] = {
      slabTier: def.key,
      tierLabel: def.label,
      minAmount: def.min,
      maxAmount: def.max,
      totalReceipts: totalInTier,
      unservedReceipts: unservedInTier,
      eligibleBoxes,
      distributedBoxes,
      remainingBoxes,
    };
  }

  // Compute receipt-level box contribution for the checklist/breakdown.
  const usedUniqueAmounts = new Set<number>();
  const receiptGroups: Record<string, BookGroup> = {};
  for (const book of books) {
    receiptGroups[book.bookNumber] = {
      bookNumber: book.bookNumber,
      status: book.status,
      assignedAt: book.assignedAt.toISOString(),
      receipts: [],
    };
  }

  for (const r of normalizedReceipts) {
    const tier = classifyTier(r.amountNum);
    let boxesGenerated = 0;
    if (tier.oneBoxPerUniqueAmount) {
      if (!usedUniqueAmounts.has(r.amountNum)) {
        usedUniqueAmounts.add(r.amountNum);
        boxesGenerated = 1;
      }
    } else {
      boxesGenerated = 1;
    }

    const group = receiptGroups[r.bookNumber] ?? {
      bookNumber: r.bookNumber,
      status: BookStatus.ASSIGNED,
      assignedAt: r.entryDate.toISOString(),
      receipts: [],
    };

    group.receipts.push({
      id: r.id,
      receiptNo: r.receiptNo,
      donorName: r.donorName,
      amount: toINR(r.amountNum),
      prasadDistributed: r.prasadDistributed,
      distributedAt: r.distributedAt ? r.distributedAt.toISOString() : null,
      boxesGenerated,
    });
    receiptGroups[r.bookNumber] = group;
  }

  const receiptsByBook = Object.values(receiptGroups).sort((a, b) =>
    a.bookNumber.localeCompare(b.bookNumber)
  );

  const booksCompleted = books.filter((b) => b.status === BookStatus.SUBMITTED).length;
  const booksPartially = books.filter((b) => b.status === BookStatus.PARTIALLY_SUBMITTED).length;

  const grandEligible = Object.values(tierLookup).reduce((sum, t) => sum + t.eligibleBoxes, 0);
  const grandDistributed = Object.values(tierLookup).reduce((sum, t) => sum + t.distributedBoxes, 0);

  return {
    sevak,
    books: {
      total: books.length,
      completed: booksCompleted,
      partially: booksPartially,
      pending: books.length - booksCompleted,
    },
    receipts: {
      total: totalReceipts,
      served: servedReceipts,
      unserved: unservedReceipts,
    },
    tiers: TIER_DEFS.map((d) => tierLookup[d.key]),
    grandTotal: {
      totalSevaAmount: toINR(totalSevaAmount),
      eligibleBoxes: grandEligible,
      distributedBoxes: grandDistributed,
      pendingBoxes: Math.max(0, grandEligible - grandDistributed),
    },
    receiptsByBook,
  };
}

export async function getSevakDistributionOverview(
  sevakId: string
): Promise<DistributionOverview | null> {
  const sevak = await prisma.sevak.findUnique({
    where: { id: sevakId },
    include: {
      receipts: true,
      assignedBooks: true,
      distributions: true,
    },
  });

  if (!sevak) return null;

  const { receipts, assignedBooks, distributions, ...sevakData } = sevak;
  return buildOverview(sevakData, receipts, distributions, assignedBooks);
}

export interface MasterExportSevak {
  sevakCode: string;
  fullName: string;
  mobile: string;
  mandal: string;
  kshetra: string;
  totalSevaAmount: number;
  totalBooks: number;
  totalReceipts: number;
  eligibleBoxes: number;
  givenBoxes: number;
  pendingBoxes: number;
}

export interface MasterExportRow {
  overview: MasterExportSevak;
  tierBreakdown: TierBreakdown[];
  receipts: DistributionReceipt[];
  bookNumber: string;
}

export async function getMasterSummaryExportData(): Promise<{
  sevaks: MasterExportSevak[];
  tierRows: Array<{ tierLabel: string; sevakCode: string; totalReceipts: number; unservedReceipts: number; eligibleBoxes: number; distributedBoxes: number; remainingBoxes: number }>;
  auditRows: Array<{ bookNumber: string; receiptNo: string; sevakCode: string; fullName: string; donorName: string | null; amount: number; distributed: boolean; distributedAt: string | null }>;
}> {
  const sevaks = await prisma.sevak.findMany({
    include: {
      receipts: true,
      assignedBooks: true,
      distributions: true,
    },
    orderBy: { sevakCode: 'asc' },
  });

  const sevakRows: MasterExportSevak[] = [];
  const tierRows: Array<{
    tierLabel: string;
    sevakCode: string;
    totalReceipts: number;
    unservedReceipts: number;
    eligibleBoxes: number;
    distributedBoxes: number;
    remainingBoxes: number;
  }> = [];

  const auditRows: Array<{
    bookNumber: string;
    receiptNo: string;
    sevakCode: string;
    fullName: string;
    donorName: string | null;
    amount: number;
    distributed: boolean;
    distributedAt: string | null;
  }> = [];

  for (const sevak of sevaks) {
    const { receipts, assignedBooks, distributions, ...sevakData } = sevak;
    const overview = buildOverview(sevakData, receipts, distributions, assignedBooks);

    sevakRows.push({
      sevakCode: sevakData.sevakCode,
      fullName: sevakData.fullName,
      mobile: sevakData.mobile,
      mandal: sevakData.mandal,
      kshetra: sevakData.kshetra,
      totalSevaAmount: overview.grandTotal.totalSevaAmount,
      totalBooks: overview.books.total,
      totalReceipts: overview.receipts.total,
      eligibleBoxes: overview.grandTotal.eligibleBoxes,
      givenBoxes: overview.grandTotal.distributedBoxes,
      pendingBoxes: overview.grandTotal.pendingBoxes,
    });

    for (const tier of overview.tiers) {
      if (tier.totalReceipts > 0) {
        tierRows.push({
          tierLabel: tier.tierLabel,
          sevakCode: sevakData.sevakCode,
          totalReceipts: tier.totalReceipts,
          unservedReceipts: tier.unservedReceipts,
          eligibleBoxes: tier.eligibleBoxes,
          distributedBoxes: tier.distributedBoxes,
          remainingBoxes: tier.remainingBoxes,
        });
      }
    }

    for (const group of overview.receiptsByBook) {
      for (const r of group.receipts) {
        auditRows.push({
          bookNumber: group.bookNumber,
          receiptNo: r.receiptNo,
          sevakCode: sevakData.sevakCode,
          fullName: sevakData.fullName,
          donorName: r.donorName,
          amount: r.amount,
          distributed: r.prasadDistributed,
          distributedAt: r.distributedAt,
        });
      }
    }
  }

  return { sevaks: sevakRows, tierRows, auditRows };
}
