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

export interface PrasadSummary {
  totalEligibleBoxes: number;
  totalDistributedBoxes: number;
  balanceBoxes: number;
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
