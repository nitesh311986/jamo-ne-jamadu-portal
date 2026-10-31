import { classifySlabLabel, computePrasadItems } from './prasad.service';
import prisma from '../lib/prisma';

export interface ActivityItem {
  type: string;
  description: string;
  sevak: string | null;
  timestamp: string;
}

export interface MonthlyTrendPoint {
  label: string;
  count: number;
  amount: number;
}

export interface DenominationBreakdown {
  tier: string;
  count: number;
  amount: number;
}

export interface DashboardOverview {
  totalSevaks: number;
  totalAllocatedBooks: number;
  totalSubmittedBooks: number;
  totalPartiallySubmittedBooks: number;
  pendingBooks: number;
  totalSubmittedAmount: number;
  totalReceiptsCount: number;
}

export interface PrasadItemCounters {
  eligible: number;
  given: number;
  rem: number;
}

export interface PrasadItemsBreakdown {
  bag: PrasadItemCounters;
  smallBox: PrasadItemCounters;
  bigBox: PrasadItemCounters;
  biscuitBox: PrasadItemCounters;
  chocolateBox: PrasadItemCounters;
}

export interface PrasadSummary {
  totalEligibleBoxes: number;
  totalDistributedBoxes: number;
  balanceBoxes: number;
  items: PrasadItemsBreakdown;
}

export interface DashboardStats {
  overview: DashboardOverview;
  prasadSummary: PrasadSummary;
  recentActivity: ActivityItem[];
  charts: {
    monthlyTrend: MonthlyTrendPoint[];
    denominationBreakdown: DenominationBreakdown[];
  };
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object' && 'toNumber' in (value as Record<string, unknown>)) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value) || 0;
}

function toMonthLabel(date: Date): string {
  return date.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    totalSevaks,
    totalAllocatedBooks,
    totalSubmittedBooks,
    totalPartiallySubmittedBooks,
    totalSevaAmountAgg,
    totalReceiptsCount,
    recentReceipts,
    allReceipts,
  ] = await Promise.all([
    prisma.sevak.count(),
    prisma.bookAllocation.count(),
    prisma.bookAllocation.count({ where: { status: 'SUBMITTED' } }),
    prisma.bookAllocation.count({ where: { status: 'PARTIALLY_SUBMITTED' } }),
    prisma.sevaReceipt.aggregate({ _sum: { amount: true } }),
    prisma.sevaReceipt.count(),
    prisma.sevaReceipt.findMany({
      take: 8,
      orderBy: { createdAt: 'desc' },
      select: {
        receiptNo: true,
        donorName: true,
        amount: true,
        createdAt: true,
        sevak: {
          select: {
            fullName: true,
          },
        },
      },
    }),
    prisma.sevaReceipt.findMany({
      select: {
        amount: true,
        entryDate: true,
        createdAt: true,
      },
    }),
  ]);

  const totalSevaAmount = toNumber(totalSevaAmountAgg._sum.amount);
  const pendingBooks = totalAllocatedBooks - (totalSubmittedBooks + totalPartiallySubmittedBooks);

  // Default safe fallback structure for all 5 Prasad items
  const prasadItems: PrasadItemsBreakdown = {
    bag: { eligible: 0, given: 0, rem: 0 },
    smallBox: { eligible: 0, given: 0, rem: 0 },
    bigBox: { eligible: 0, given: 0, rem: 0 },
    biscuitBox: { eligible: 0, given: 0, rem: 0 },
    chocolateBox: { eligible: 0, given: 0, rem: 0 },
  };

  let totalEligibleBoxes = 0;

  try {
    for (const receipt of allReceipts) {
      const items = computePrasadItems(toNumber(receipt.amount));
      totalEligibleBoxes +=
        items.bag + items.small + items.big + items.biscuit + items.chocolate;
    }

    const distributions = await prisma.prasadDistribution.findMany();

    if (Array.isArray(distributions) && distributions.length > 0) {
      for (const dist of distributions) {
        const eligBag = toNumber(dist.eligibleBag ?? 0);
        const distBag = toNumber(dist.distributedBag ?? 0);
        const extBag = toNumber(dist.extraBag ?? 0);
        prasadItems.bag.eligible += eligBag;
        prasadItems.bag.given += distBag + extBag;
        prasadItems.bag.rem += Math.max(0, eligBag - distBag);

        const eligSmall = toNumber(dist.eligibleSmall ?? 0);
        const distSmall = toNumber(dist.distributedSmall ?? 0);
        const extSmall = toNumber(dist.extraSmall ?? 0);
        prasadItems.smallBox.eligible += eligSmall;
        prasadItems.smallBox.given += distSmall + extSmall;
        prasadItems.smallBox.rem += Math.max(0, eligSmall - distSmall);

        const eligBig = toNumber(dist.eligibleBig ?? 0);
        const distBig = toNumber(dist.distributedBig ?? 0);
        const extBig = toNumber(dist.extraBig ?? 0);
        prasadItems.bigBox.eligible += eligBig;
        prasadItems.bigBox.given += distBig + extBig;
        prasadItems.bigBox.rem += Math.max(0, eligBig - distBig);

        const eligBisc = toNumber(dist.eligibleBiscuit ?? 0);
        const distBisc = toNumber(dist.distributedBiscuit ?? 0);
        const extBisc = toNumber(dist.extraBiscuit ?? 0);
        prasadItems.biscuitBox.eligible += eligBisc;
        prasadItems.biscuitBox.given += distBisc + extBisc;
        prasadItems.biscuitBox.rem += Math.max(0, eligBisc - distBisc);

        const eligChoc = toNumber(dist.eligibleChocolate ?? 0);
        const distChoc = toNumber(dist.distributedChocolate ?? 0);
        const extChoc = toNumber(dist.extraChocolate ?? 0);
        prasadItems.chocolateBox.eligible += eligChoc;
        prasadItems.chocolateBox.given += distChoc + extChoc;
        prasadItems.chocolateBox.rem += Math.max(0, eligChoc - distChoc);
      }
    }
  } catch (prasadError) {
    // If a Prisma table/column mismatch occurs, log clearly and preserve other stats
    console.warn(
      '[DashboardService] PrasadDistribution calculation failed safely:',
      (prasadError as Error)?.message || prasadError
    );
  }

  const totalDistributedBoxes =
    prasadItems.bag.given +
    prasadItems.smallBox.given +
    prasadItems.bigBox.given +
    prasadItems.biscuitBox.given +
    prasadItems.chocolateBox.given;

  const monthlyMap = new Map<string, { label: string; count: number; amount: number }>();
  const monthlyKeys: string[] = [];

  for (const receipt of allReceipts) {
    const date = new Date(receipt.entryDate ?? receipt.createdAt);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    if (!monthlyMap.has(key)) {
      monthlyMap.set(key, { label: toMonthLabel(date), count: 0, amount: 0 });
      monthlyKeys.push(key);
    }

    const point = monthlyMap.get(key)!;
    point.count += 1;
    point.amount += toNumber(receipt.amount);
  }

  monthlyKeys.sort();
  const monthlyTrend: MonthlyTrendPoint[] = monthlyKeys.slice(-12).map((key) => monthlyMap.get(key)!);

  const denominationMap = new Map<string, DenominationBreakdown>();
  for (const receipt of allReceipts) {
    const amount = toNumber(receipt.amount);
    const label = classifySlabLabel(amount);
    const existing = denominationMap.get(label) ?? { tier: label, count: 0, amount: 0 };
    existing.count += 1;
    existing.amount += amount;
    denominationMap.set(label, existing);
  }

  const denominationBreakdown: DenominationBreakdown[] = Array.from(denominationMap.values()).sort(
    (a, b) => b.amount - a.amount
  );

  const recentActivity: ActivityItem[] = recentReceipts.map((receipt) => ({
    type: 'RECEIPT_LOGGED',
    description: `Seva receipt logged for ${toNumber(receipt.amount).toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    })}`,
    sevak: receipt.sevak?.fullName ?? null,
    timestamp: receipt.createdAt.toISOString(),
  }));

  return {
    overview: {
      totalSevaks,
      totalAllocatedBooks,
      totalSubmittedBooks,
      totalPartiallySubmittedBooks,
      pendingBooks,
      totalSubmittedAmount: Math.round(totalSevaAmount * 100) / 100,
      totalReceiptsCount,
    },
    prasadSummary: {
      totalEligibleBoxes,
      totalDistributedBoxes,
      balanceBoxes: Math.max(0, totalEligibleBoxes - totalDistributedBoxes),
      items: prasadItems,
    },
    recentActivity,
    charts: {
      monthlyTrend,
      denominationBreakdown,
    },
  };
}
