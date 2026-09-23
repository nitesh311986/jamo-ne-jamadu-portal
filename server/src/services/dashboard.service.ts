import { classifyTier } from './prasad.service';
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

export interface PrasadSummary {
  totalEligibleBoxes: number;
  totalDistributedBoxes: number;
  balanceBoxes: number;
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
    totalBoxesEligibleAgg,
    totalBoxesDistributedAgg,
    recentReceipts,
    allReceipts,
  ] = await Promise.all([
    prisma.sevak.count(),
    prisma.bookAllocation.count(),
    prisma.bookAllocation.count({ where: { status: 'SUBMITTED' } }),
    prisma.bookAllocation.count({ where: { status: 'PARTIALLY_SUBMITTED' } }),
    prisma.sevaReceipt.aggregate({ _sum: { amount: true } }),
    prisma.sevaReceipt.count(),
    prisma.prasadDistribution.aggregate({ _sum: { eligibleBoxes: true } }),
    prisma.prasadDistribution.aggregate({ _sum: { distributedBoxes: true } }),
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
  const totalEligibleBoxes = totalBoxesEligibleAgg._sum.eligibleBoxes ?? 0;
  const totalDistributedBoxes = totalBoxesDistributedAgg._sum.distributedBoxes ?? 0;

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
    const tier = classifyTier(amount);
    const existing = denominationMap.get(tier.label) ?? { tier: tier.label, count: 0, amount: 0 };
    existing.count += 1;
    existing.amount += amount;
    denominationMap.set(tier.label, existing);
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
    },
    recentActivity,
    charts: {
      monthlyTrend,
      denominationBreakdown,
    },
  };
}
