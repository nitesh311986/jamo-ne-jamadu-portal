import { useEffect, useState, useCallback, useMemo, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  UserPlus,
  BookOpen,
  CheckCircle2,
  IndianRupee,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  Package,
  Receipt,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { formatINR } from '../utils/currency';
import { fetchDashboardStats, type DashboardData } from '../services/dashboard.service';

interface KpiCardProps {
  label: string;
  value: string;
  subtext?: string;
  icon: typeof Users;
  iconBg: string;
  iconColor: string;
}

function KpiCard({ label, value, subtext, icon: Icon, iconBg, iconColor }: KpiCardProps): ReactElement {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white p-5 text-center shadow-sm transition hover:shadow-md">
      <div className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${iconBg} ${iconColor}`}>
        <Icon size={24} />
      </div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-800">{value}</p>
      {subtext && (
        <p className="mt-1 text-xs font-semibold text-slate-400">{subtext}</p>
      )}
    </div>
  );
}

export default function Dashboard(): ReactElement {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadStats = useCallback(async (): Promise<void> => {
    try {
      setError('');
      const data = await fetchDashboardStats();
      setStats(data);
      setLastUpdated(new Date());
    } catch {
      setError('Unable to load dashboard stats. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
    const interval = setInterval(() => {
      void loadStats();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadStats]);

  const overview = stats?.overview;

  const collectionRate = useMemo((): number => {
    if (!overview || overview.totalAllocatedBooks === 0) return 0;
    const returned = overview.totalSubmittedBooks + overview.totalPartiallySubmittedBooks;
    return Math.round((returned / overview.totalAllocatedBooks) * 100);
  }, [overview]);

  const distributionRate = useMemo((): number => {
    if (!stats || stats.prasadSummary.totalEligibleBoxes === 0) return 0;
    return Math.round(
      (stats.prasadSummary.totalDistributedBoxes / stats.prasadSummary.totalEligibleBoxes) * 100
    );
  }, [stats]);

  const monthlyTrend = stats?.charts?.monthlyTrend ?? [];
  const maxTrendAmount = useMemo((): number => {
    if (monthlyTrend.length === 0) return 1;
    return Math.max(...monthlyTrend.map((m) => m.amount), 1);
  }, [monthlyTrend]);

  const quickNav = [
    { label: 'Register Sevak', to: '/sevaks/register', icon: UserPlus, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Allocate Books', to: '/books/allocate', icon: BookOpen, color: 'bg-blue-50 text-blue-600' },
    { label: 'Book Collection', to: '/receipts/entry', icon: Receipt, color: 'bg-amber-50 text-amber-600' },
    { label: 'Prasad Counter', to: '/prasad', icon: Package, color: 'bg-purple-50 text-purple-600' },
  ];

  const kpiCards: KpiCardProps[] = [
    {
      label: 'કુલ નોંധાયેલ સેવકો / Enrolled Sevaks',
      value: loading ? '---' : String(overview?.totalSevaks ?? 0),
      icon: Users,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-500',
    },
    {
      label: 'કુલ ફાળવેલ બુક / Allocated Books',
      value: loading ? '---' : String(overview?.totalAllocatedBooks ?? 0),
      subtext: loading ? '' : `${overview?.pendingBooks ?? 0} pending return`,
      icon: BookOpen,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-500',
    },
    {
      label: 'પરત જમા થયેલ બુક / Submitted Books',
      value: loading ? '---' : String(overview?.totalSubmittedBooks ?? 0),
      subtext: loading ? '' : `+ ${overview?.totalPartiallySubmittedBooks ?? 0} partial`,
      icon: CheckCircle2,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-500',
    },
    {
      label: 'કુલ જમા થયેલ સેવા રકમ / Total Seva Amount',
      value: loading ? '---' : formatINR(overview?.totalSubmittedAmount ?? 0),
      subtext: loading ? '' : `${overview?.totalReceiptsCount ?? 0} total receipts`,
      icon: IndianRupee,
      iconBg: 'bg-teal-50',
      iconColor: 'text-teal-500',
    },
  ];

  return (
    <div className="space-y-6">
      <section className="relative mb-6 overflow-hidden rounded-3xl bg-linear-to-r from-sky-100 to-blue-50 px-5 py-6 sm:px-8 sm:py-8">
        <div className="relative z-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <img
              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName ?? 'User')}&background=0D8ABC&color=fff`}
              alt="User avatar"
              className="h-14 w-14 rounded-full object-cover ring-2 ring-white shadow-sm"
            />
            <div>
              <h2 className="text-lg font-bold text-slate-800 sm:text-xl">
                Welcome back! {user?.fullName ?? user?.email}
              </h2>
              <p className="text-sm text-slate-500">Live executive analytics for the Jamo Ne Jamadu Seva Portal.</p>
            </div>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {lastUpdated && (
              <p className="text-xs text-slate-500">
                Last updated: {lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
            <button
              type="button"
              onClick={() => void loadStats()}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh Stats
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((card) => (
          <KpiCard key={card.label} {...card} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 lg:col-span-2">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Seva Collection Trend</h3>
              <p className="text-sm text-slate-500">Monthly receipt overview</p>
            </div>
          </div>

          <div className="h-48 sm:h-56">
            {monthlyTrend.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-slate-400">
                No receipt data available yet.
              </div>
            ) : (
              <div className="flex h-full items-end justify-between gap-1 sm:gap-2">
                {monthlyTrend.map((bar) => {
                  const value = Math.round((bar.amount / maxTrendAmount) * 100);
                  const primary = Math.round(value * 0.7);
                  return (
                    <div key={bar.label} className="group flex flex-1 flex-col items-center gap-2">
                      <div className="relative w-full max-w-7 flex-1 overflow-hidden rounded-t-xl bg-blue-100" style={{ height: `${value}%` }}>
                        <div
                          className="absolute bottom-0 w-full rounded-t-xl bg-linear-to-t from-blue-600 to-blue-400"
                          style={{ height: `${primary}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 sm:text-xs">{bar.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-lg font-bold text-slate-800">Summary Progress</h3>
          <p className="text-sm text-slate-500">Book & prasad collection rates</p>
          <p className="mt-3 text-2xl font-bold text-slate-800">
            {loading ? '---' : formatINR(overview?.totalSubmittedAmount ?? 0)}
          </p>
          <p className="mt-1 flex items-center gap-1 text-sm text-emerald-500">
            <TrendingUp size={16} />
            {collectionRate}% books collected
          </p>

          <div className="relative mx-auto mt-6 h-40 w-40">
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="4"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#3b82f6"
                strokeWidth="4"
                strokeDasharray={`${collectionRate}, 100`}
                strokeLinecap="round"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#10b981"
                strokeWidth="4"
                strokeDasharray={`${distributionRate}, 100`}
                strokeDashoffset={`-${collectionRate}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-24 w-24 rounded-full bg-slate-50" />
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                Book Collection
              </span>
              <span className="font-semibold text-slate-700">{collectionRate}%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Prasad Distribution
              </span>
              <span className="font-semibold text-slate-700">{distributionRate}%</span>
            </div>
          </div>

          {stats && stats.recentActivity.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <h4 className="text-sm font-semibold text-slate-700">Recent Activity</h4>
              <ul className="mt-2 space-y-2">
                {stats.recentActivity.slice(0, 4).map((item, index) => (
                  <li key={index} className="text-xs text-slate-500">
                    <span className="font-medium text-slate-700">{item.description}</span>
                    {item.sevak && <span className="block text-slate-400">by {item.sevak}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-bold text-slate-800">Quick Navigation</h3>
        <p className="text-sm text-slate-500">Common operator workflows</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickNav.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.to}
                to={action.to}
                className="group flex items-center justify-between rounded-2xl border border-slate-200 p-4 transition hover:border-blue-300 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.color}`}>
                    <Icon size={20} />
                  </div>
                  <span className="font-semibold text-slate-800">{action.label}</span>
                </div>
                <ArrowRight size={16} className="text-slate-300 group-hover:text-blue-500" />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
