import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { Users, UserPlus, Search, Shield, Handshake, TrendingUp, Receipt, BookOpen } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface StatItem {
  label: string;
  value: string;
  trend?: string;
  icon: typeof Users;
  iconBg: string;
  iconColor: string;
}

const adminStats: StatItem[] = [
  { label: 'Total Sevaks', value: '1,248', trend: '+1K', icon: Users, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
  { label: 'New Registrations', value: '86', trend: '10+', icon: UserPlus, iconBg: 'bg-rose-50', iconColor: 'text-rose-500' },
  { label: 'Active Volunteers', value: '42', trend: '8+', icon: Handshake, iconBg: 'bg-sky-50', iconColor: 'text-sky-500' },
  { label: 'Kshetras', value: '12', trend: '$96k', icon: Search, iconBg: 'bg-amber-50', iconColor: 'text-amber-500' },
  { label: 'Mandals', value: '96', icon: Users, iconBg: 'bg-indigo-50', iconColor: 'text-indigo-500' },
  { label: 'Admin Tasks', value: '696', icon: Shield, iconBg: 'bg-rose-50', iconColor: 'text-rose-500' },
];

const volunteerStats: StatItem[] = [
  { label: 'My Sevaks', value: '124', trend: '+12', icon: Users, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-500' },
  { label: 'Registrations', value: '18', trend: '5+', icon: UserPlus, iconBg: 'bg-rose-50', iconColor: 'text-rose-500' },
  { label: 'Kshetra Reach', value: '3', icon: Handshake, iconBg: 'bg-sky-50', iconColor: 'text-sky-500' },
  { label: 'Contacts Added', value: '1,420', icon: Search, iconBg: 'bg-amber-50', iconColor: 'text-amber-500' },
];

const revenueData = [
  { month: 'Jan', value: 40, primary: 25 },
  { month: 'Feb', value: 70, primary: 50 },
  { month: 'Mar', value: 55, primary: 35 },
  { month: 'Apr', value: 85, primary: 55 },
  { month: 'May', value: 45, primary: 30 },
  { month: 'Jun', value: 35, primary: 20 },
  { month: 'Jul', value: 60, primary: 40 },
  { month: 'Aug', value: 50, primary: 32 },
  { month: 'Sep', value: 75, primary: 48 },
  { month: 'Oct', value: 65, primary: 42 },
  { month: 'Nov', value: 80, primary: 50 },
  { month: 'Dec', value: 55, primary: 35 },
];

const quickActions = [
  { label: 'Register Sevak', to: '/sevaks/register', icon: UserPlus },
  { label: 'Find Sevak', to: '/sevaks', icon: Search },
  { label: 'Book Collection', to: '/receipts/entry', icon: BookOpen },
  { label: 'Receipt Search', to: '/receipts/search', icon: Receipt },
  { label: 'Manage Users', to: '/admin/users', icon: Shield },
];

export default function Dashboard(): ReactElement {
  const { user } = useAuth();
  const isAdmin = user?.role === 'SUPER_ADMIN';
  const stats = isAdmin ? adminStats : volunteerStats;
  const visibleActions = quickActions.filter(
    (a) => a.to !== '/admin/users' || isAdmin
  );

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
              <p className="text-sm text-slate-500">Check your reports and manage your seva work.</p>
            </div>
          </div>
          <div className="hidden sm:block">
            <img
              src="https://img.freepik.com/free-vector/business-analytics-concept-illustration_114360-1398.jpg?w=300"
              alt="Dashboard illustration"
              className="h-28 w-auto rounded-2xl object-cover opacity-90"
            />
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white p-5 text-center shadow-sm transition hover:shadow-md"
            >
              <div
                className={`mb-3 flex h-12 w-12 items-center justify-center rounded-2xl ${stat.iconBg} ${stat.iconColor}`}
              >
                <Icon size={24} />
              </div>
              <p className="text-sm font-medium text-slate-500">{stat.label}</p>
              <p className="mt-1 text-xl font-bold text-slate-800">{stat.value}</p>
              {stat.trend && (
                <p className={`mt-1 text-sm font-semibold ${stat.trend.startsWith('+') ? 'text-emerald-500' : stat.iconColor}`}>
                  {stat.trend}
                </p>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6 lg:col-span-2">
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Revenue updates</h3>
              <p className="text-sm text-slate-500">Overview of seva progress</p>
            </div>
            <select
              defaultValue="2025"
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
            >
              <option value="2025">Year 2025</option>
              <option value="2024">Year 2024</option>
              <option value="2023">Year 2023</option>
            </select>
          </div>

          <div className="h-48 sm:h-56">
            <div className="flex h-full items-end justify-between gap-1 sm:gap-2">
              {revenueData.map((bar) => (
                <div key={bar.month} className="group flex flex-1 flex-col items-center gap-2">
                  <div className="relative w-full max-w-7 flex-1 overflow-hidden rounded-t-xl bg-blue-100" style={{ height: `${bar.value}%` }}>
                    <div
                      className="absolute bottom-0 w-full rounded-t-xl bg-linear-to-t from-blue-600 to-blue-400"
                      style={{ height: `${(bar.primary / bar.value) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 sm:text-xs">{bar.month}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
          <h3 className="text-lg font-bold text-slate-800">Yearly Breakup</h3>
          <p className="text-sm text-slate-500">Total outreach</p>
          <p className="mt-3 text-2xl font-bold text-slate-800">₹36,358</p>
          <p className="mt-1 flex items-center gap-1 text-sm text-emerald-500">
            <TrendingUp size={16} />
            +9% last year
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
                strokeDasharray="70, 100"
                strokeLinecap="round"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="#93c5fd"
                strokeWidth="4"
                strokeDasharray="30, 100"
                strokeDashoffset="-70"
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
                2023
              </span>
              <span className="font-semibold text-slate-700">70%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-300" />
                2024
              </span>
              <span className="font-semibold text-slate-700">30%</span>
            </div>
          </div>
        </section>
      </div>

      <div className="mt-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-lg font-bold text-slate-800">Quick Actions</h3>
        <p className="text-sm text-slate-500">Jump to common tasks</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.to}
                to={action.to}
                className="group flex items-center gap-4 rounded-2xl border border-slate-200 p-4 transition hover:border-blue-300 hover:shadow-md"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 group-hover:bg-blue-100">
                  <Icon size={20} />
                </div>
                <span className="font-semibold text-slate-800">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
