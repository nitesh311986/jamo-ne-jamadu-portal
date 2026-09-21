import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { ArrowLeft, Plus, X } from 'lucide-react';
import api from '../api/axios';
import { Link } from 'react-router-dom';
import type { User, UserListResponse, CreateUserRequest, ApiError } from '../types/auth';
import type { AxiosError } from 'axios';

const ROLES: Array<User['role']> = ['SUPER_ADMIN', 'VOLUNTEER'];

interface CreateUserForm {
  email: string;
  password: string;
  fullName: string;
  phoneNumber: string;
  role: User['role'];
}

async function loadUsers(): Promise<User[]> {
  const response = await api.get<UserListResponse>('/api/v1/auth/users');
  return response.data.users;
}

const initialForm: CreateUserForm = {
  email: '',
  password: '',
  fullName: '',
  phoneNumber: '',
  role: 'VOLUNTEER',
};

export default function AdminUsers(): ReactElement {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [listError, setListError] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [form, setForm] = useState<CreateUserForm>(initialForm);
  const [formError, setFormError] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    loadUsers()
      .then((loadedUsers) => {
        setUsers(loadedUsers);
        setListError('');
      })
      .catch((err) => {
        const message =
          (err as AxiosError<ApiError>).response?.data?.error ?? 'Failed to load users';
        setListError(message);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleChange = (field: keyof CreateUserForm, value: string): void => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setFormError('');
    setIsSaving(true);

    const payload: CreateUserRequest = {
      email: form.email.trim(),
      password: form.password,
      fullName: form.fullName.trim(),
      phoneNumber: form.phoneNumber.trim() || undefined,
      role: form.role,
    };

    try {
      await api.post('/api/v1/auth/users', payload);
      setForm(initialForm);
      setIsModalOpen(false);
      const loadedUsers = await loadUsers();
      setUsers(loadedUsers);
      setListError('');
    } catch (err) {
      const message = (err as AxiosError<ApiError>).response?.data?.error ?? 'Failed to create user';
      setFormError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/dashboard"
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Back</span>
          </Link>
          <h1 className="text-lg font-bold text-slate-800 sm:text-xl">User Management</h1>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
        >
          <Plus size={18} />
          New User
        </button>
      </div>

      <main className="space-y-4">


        {listError && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{listError}</div>
        )}

        {isLoading ? (
          <div className="py-12 text-center text-slate-500">Loading users...</div>
        ) : (
          <div className="space-y-3 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0 lg:grid-cols-3">
            {users.map((u) => (
              <div
                key={u.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-1 font-medium text-slate-800">{u.fullName}</div>
                <div className="text-sm text-slate-500">{u.email}</div>
                {u.phoneNumber && (
                  <div className="text-sm text-slate-400">{u.phoneNumber}</div>
                )}
                <div className="mt-2 inline-flex items-center rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
                  {u.role.replace('_', ' ')}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">Create User</h3>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setForm(initialForm);
                  setFormError('');
                }}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Full Name</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => handleChange('fullName', e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Phone</label>
                <input
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(e) => handleChange('phoneNumber', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
                <select
                  value={form.role}
                  onChange={(e) => handleChange('role', e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
                >
                  {ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>

              {formError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{formError}</div>
              )}

              <button
                type="submit"
                disabled={isSaving}
                className="w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Creating...' : 'Create User'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
