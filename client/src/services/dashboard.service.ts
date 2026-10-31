import api from '../api/axios';

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

export interface DashboardData {
  overview: DashboardOverview;
  prasadSummary: PrasadSummary;
  recentActivity: ActivityItem[];
  charts: {
    monthlyTrend: MonthlyTrendPoint[];
    denominationBreakdown: DenominationBreakdown[];
  };
}

export interface DashboardStatsResponse {
  success: boolean;
  data: DashboardData;
}

export async function fetchDashboardStats(): Promise<DashboardData> {
  const response = await api.get<DashboardStatsResponse>('/api/v1/dashboard/stats');
  return response.data.data;
}
