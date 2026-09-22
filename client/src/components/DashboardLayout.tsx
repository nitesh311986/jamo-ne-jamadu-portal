import { useState, type ReactElement } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Search,
  Shield,
  LogOut,
  Menu,
  X,
  Bell,
  Search as SearchIcon,
  BookOpen,
  Receipt,
  HandHeart,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface NavItem {
  label: string;
  to: string;
  icon: typeof LayoutDashboard;
  allowedRoles?: Array<'SUPER_ADMIN' | 'VOLUNTEER'>;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Sevak Registration', to: '/sevaks/register', icon: UserPlus, allowedRoles: ['SUPER_ADMIN', 'VOLUNTEER'] },
  { label: 'Sevak Directory', to: '/sevaks', icon: Search, allowedRoles: ['SUPER_ADMIN', 'VOLUNTEER'] },
  { label: 'Book Allocation', to: '/books/allocate', icon: BookOpen, allowedRoles: ['SUPER_ADMIN', 'VOLUNTEER'] },
  { label: 'Book Collection', to: '/receipts/entry', icon: BookOpen, allowedRoles: ['SUPER_ADMIN', 'VOLUNTEER'] },
  { label: 'Receipt Search', to: '/receipts/search', icon: Receipt, allowedRoles: ['SUPER_ADMIN', 'VOLUNTEER'] },
  { label: 'Prasad Counter', to: '/prasad', icon: HandHeart, allowedRoles: ['SUPER_ADMIN', 'VOLUNTEER'] },
  { label: 'Admin Users', to: '/admin/users', icon: Shield, allowedRoles: ['SUPER_ADMIN'] },
];

export default function DashboardLayout(): ReactElement {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const filteredNav = navItems.filter(
    (item) => !item.allowedRoles || (user && item.allowedRoles.includes(user.role))
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <button
        type="button"
        onClick={() => setIsSidebarOpen(true)}
        className="fixed left-4 top-4 z-40 rounded-xl bg-white p-2.5 shadow-md lg:hidden"
        aria-label="Open menu"
      >
        <Menu size={20} className="text-slate-700" />
      </button>

      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 h-screen w-64 transform bg-white shadow-lg transition-transform duration-300 lg:translate-x-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-blue-500 to-cyan-400 text-white">
                <Users size={20} />
              </div>
              <span className="text-lg font-bold text-slate-800">JamoAdmin</span>
            </div>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 lg:hidden"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-4">
            <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Home</p>
            <ul className="space-y-1">
              {filteredNav.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.to;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        isActive
                          ? 'bg-blue-50 text-blue-600'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon size={18} />
                      {item.label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="border-t border-slate-100 p-4">
            <button
              onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-6">
          <div className="mx-auto flex max-w-6xl items-center justify-end gap-3 sm:justify-between">
            <div className="relative hidden w-full max-w-md sm:block">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search..."
                className="w-full rounded-full border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-sm text-slate-700 outline-none transition focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                type="button"
                className="relative rounded-full bg-slate-50 p-2.5 text-slate-600 transition hover:bg-slate-100"
                aria-label="Notifications"
              >
                <Bell size={20} />
                <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500" />
              </button>
              <div className="flex items-center gap-3">
                <img
                  src="https://ui-avatars.com/api/?name=Admin+User&background=0D8ABC&color=fff"
                  alt="User avatar"
                  className="h-9 w-9 rounded-full object-cover ring-2 ring-slate-100"
                />
                <div className="hidden leading-tight sm:block">
                  <p className="text-sm font-semibold text-slate-800">{user?.fullName ?? user?.email}</p>
                  <p className="text-xs text-slate-500">{user?.role === 'SUPER_ADMIN' ? 'Administrator' : 'Volunteer'}</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <div className="mx-auto max-w-6xl"><Outlet /></div>
        </main>
      </div>
    </div>
  );
}
