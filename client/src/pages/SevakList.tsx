import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  FileDown,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import api from '../api/axios';
import PaginationControls from '../components/common/PaginationControls';
import type { MessageResponse, Sevak, SevakResponse, SevakSearchResponse, UpdateSevakRequest } from '../types/sevak';
import type { ApiError } from '../types/auth';
import type { AxiosError } from 'axios';

interface FormState {
  fullName: string;
  firstName: string;
  lastName: string;
  mobile: string;
  altMobile: string;
  whatsapp: string;
  address: string;
  mandal: string;
  kshetra: string;
  expectedContacts: string;
}

interface AlertState {
  type: 'success' | 'error';
  message: string;
}

function deriveFirstAndLast(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }
  return { firstName: parts[0], lastName: parts[parts.length - 1] };
}

function sevakToFormState(sevak: Sevak): FormState {
  return {
    fullName: sevak.fullName,
    firstName: sevak.firstName,
    lastName: sevak.lastName,
    mobile: sevak.mobile,
    altMobile: sevak.altMobile ?? '',
    whatsapp: sevak.whatsapp ?? '',
    address: sevak.address,
    mandal: sevak.mandal,
    kshetra: sevak.kshetra,
    expectedContacts: String(sevak.expectedContacts),
  };
}

export default function SevakList(): ReactElement {
  const [query, setQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [sevaks, setSevaks] = useState<Sevak[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const [editingSevak, setEditingSevak] = useState<Sevak | null>(null);
  const [editForm, setEditForm] = useState<FormState>({
    fullName: '',
    firstName: '',
    lastName: '',
    mobile: '',
    altMobile: '',
    whatsapp: '',
    address: '',
    mandal: '',
    kshetra: '',
    expectedContacts: '',
  });
  const [editError, setEditError] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<{ mobile: string; whatsapp: string }>({
    mobile: '',
    whatsapp: '',
  });
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [alert, setAlert] = useState<AlertState | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    async function load(): Promise<void> {
      setIsLoading(true);
      setError('');
      try {
        const response = await api.get<SevakSearchResponse>('/api/v1/sevaks/search', {
          params: { q: debouncedQuery, page, limit: pageSize },
        });
        setSevaks(response.data.sevaks);
        setTotal(response.data.total);
      } catch (err) {
        setError(
          (err as AxiosError<ApiError>).response?.data?.error ?? 'Failed to load sevaks'
        );
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [debouncedQuery, page, pageSize]);

  useEffect(() => {
    if (!alert) return;
    const timer = setTimeout(() => setAlert(null), 5000);
    return () => clearTimeout(timer);
  }, [alert]);

  const handleSearchSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setDebouncedQuery(query.trim());
    setPage(1);
  };

  const handleDownload = async (): Promise<void> => {
    setIsExporting(true);
    try {
      const response = await api.get('/api/v1/sevaks/export/excel', {
        responseType: 'blob',
      });
      const blob = new Blob([response.data as BlobPart], {
        type: String(
          response.headers['content-type'] ??
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ),
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sevaks.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(
        (err as AxiosError<ApiError>).response?.data?.error ?? 'Failed to download Excel'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleFullNameChange = (value: string): void => {
    const { firstName, lastName } = deriveFirstAndLast(value);
    setEditForm((prev) => ({
      ...prev,
      fullName: value,
      firstName,
      lastName,
    }));
  };

  const handleEditChange = (field: keyof FormState, value: string): void => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const openEdit = (sevak: Sevak): void => {
    setEditingSevak(sevak);
    setEditForm(sevakToFormState(sevak));
    setEditError('');
  };

  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    if (!editingSevak) return;

    setEditError('');
    setFieldErrors({ mobile: '', whatsapp: '' });
    setIsSavingEdit(true);

    const expected = parseInt(editForm.expectedContacts, 10);

    const payload: UpdateSevakRequest = {
      fullName: editForm.fullName.trim(),
      firstName: editForm.firstName.trim(),
      lastName: editForm.lastName.trim(),
      mobile: editForm.mobile.trim(),
      altMobile: editForm.altMobile.trim() || undefined,
      whatsapp: editForm.whatsapp.trim() || undefined,
      address: editForm.address.trim(),
      mandal: editForm.mandal.trim(),
      kshetra: editForm.kshetra.trim(),
      expectedContacts: Number.isNaN(expected) ? 0 : expected,
    };

    try {
      await api.put<SevakResponse>(`/api/v1/sevaks/${editingSevak.id}`, payload);
      setAlert({ type: 'success', message: 'Sevak updated successfully' });
      setEditingSevak(null);
      const response = await api.get<SevakSearchResponse>('/api/v1/sevaks/search', {
        params: { q: debouncedQuery, page, limit: pageSize },
      });
      setSevaks(response.data.sevaks);
      setTotal(response.data.total);
    } catch (err) {
      const axiosErr = err as AxiosError<ApiError>;
      const status = axiosErr.response?.status;
      const message = axiosErr.response?.data?.error ?? 'Failed to update sevak';
      if (status === 409) {
        const lower = message.toLowerCase();
        if (lower.includes('mobile number')) {
          setFieldErrors({ mobile: message, whatsapp: '' });
        } else if (lower.includes('whatsapp number')) {
          setFieldErrors({ mobile: '', whatsapp: message });
        } else {
          setEditError(message);
        }
      } else {
        setEditError(message);
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDelete = async (sevak: Sevak): Promise<void> => {
    if (!window.confirm(`Are you sure you want to delete ${sevak.fullName} (${sevak.sevakCode})? This action cannot be undone.`)) {
      return;
    }

    setDeletingId(sevak.id);
    try {
      await api.delete<MessageResponse>(`/api/v1/sevaks/${sevak.id}`);
      setAlert({ type: 'success', message: 'Sevak deleted successfully' });
      const response = await api.get<SevakSearchResponse>('/api/v1/sevaks/search', {
        params: { q: debouncedQuery, page, limit: pageSize },
      });
      setSevaks(response.data.sevaks);
      setTotal(response.data.total);
    } catch (err) {
      const message =
        (err as AxiosError<ApiError>).response?.data?.error ?? 'Failed to delete sevak';
      setAlert({ type: 'error', message });
    } finally {
      setDeletingId(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500';
  const readOnlyClass =
    'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600';

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
          <h1 className="text-lg font-bold text-slate-800 sm:text-xl">
            Sevak Directory
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={isExporting}
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />}
            <span className="hidden sm:inline">Excel</span>
          </button>
          <Link
            to="/sevaks/register"
            className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Register</span>
          </Link>
        </div>
      </div>

      <main className="space-y-4">
        <form onSubmit={handleSearchSubmit} className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="શોધો / Search by name, code, or mobile"
              className={`${inputClass} pl-10`}
            />
          </div>
          <button
            type="submit"
            className="hidden rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 sm:block"
          >
            Search
          </button>
        </form>

        {alert && (
          <div
            className={`mb-4 flex items-center gap-2 rounded-lg p-3 text-sm ${
              alert.type === 'success'
                ? 'bg-green-50 text-green-700'
                : 'bg-red-50 text-red-700'
            }`}
          >
            {alert.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
            {alert.message}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {isLoading ? (
          <div className="py-12 text-center text-slate-500">Loading sevaks...</div>
        ) : sevaks.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            No sevaks found{query ? ' for this search' : ''}.
          </div>
        ) : (
          <>
            <div className="mb-2 text-sm text-slate-500">
              Showing {sevaks.length} of {total} sevak{total === 1 ? '' : 's'}
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {sevaks.map((sevak) => (
                <div
                  key={sevak.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-lg font-bold tracking-wider text-orange-700">
                      {sevak.sevakCode}
                    </span>
                    <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
                      {sevak.expectedContacts} contacts
                    </span>
                  </div>
                  <div className="mb-1 font-medium text-slate-800">{sevak.fullName}</div>
                  <div className="text-sm text-slate-500">{sevak.mobile}</div>
                  <div className="mt-2 text-sm text-slate-400">
                    {sevak.mandal} &middot; {sevak.kshetra}
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => openEdit(sevak)}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
                    >
                      <Pencil size={14} />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(sevak)}
                      disabled={deletingId === sevak.id}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === sevak.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Trash2 size={14} />
                      )}
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop / tablet table */}
            <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Code</th>
                    <th className="px-4 py-3 font-medium">Full Name</th>
                    <th className="px-4 py-3 font-medium">Mobile</th>
                    <th className="px-4 py-3 font-medium">Mandal</th>
                    <th className="px-4 py-3 font-medium">Kshetra</th>
                    <th className="px-4 py-3 font-medium">Expected</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sevaks.map((sevak) => (
                    <tr key={sevak.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold tracking-wider text-orange-700">
                        {sevak.sevakCode}
                      </td>
                      <td className="px-4 py-3">{sevak.fullName}</td>
                      <td className="px-4 py-3">{sevak.mobile}</td>
                      <td className="px-4 py-3">{sevak.mandal}</td>
                      <td className="px-4 py-3">{sevak.kshetra}</td>
                      <td className="px-4 py-3">{sevak.expectedContacts}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(sevak)}
                            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
                            title="Edit sevak"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(sevak)}
                            disabled={deletingId === sevak.id}
                            className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                            title="Delete sevak"
                          >
                            {deletingId === sevak.id ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {total > 0 && (
              <PaginationControls
                currentPage={page}
                totalPages={totalPages}
                totalCount={total}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize);
                  setPage(1);
                }}
                isLoading={isLoading}
              />
            )}
          </>
        )}
      </main>

      {editingSevak && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center">
          <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-800">
                Edit Sevak: {editingSevak.sevakCode}
              </h3>
              <button
                onClick={() => setEditingSevak(null)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    પૂરું નામ / Full Name
                  </label>
                  <input
                    type="text"
                    value={editForm.fullName}
                    onChange={(e) => handleFullNameChange(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    પ્રથમ નામ / First Name
                  </label>
                  <input
                    type="text"
                    value={editForm.firstName}
                    readOnly
                    className={readOnlyClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    છેલ્લું નામ / Last Name
                  </label>
                  <input
                    type="text"
                    value={editForm.lastName}
                    readOnly
                    className={readOnlyClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    મોબાઇલ / Mobile
                  </label>
                  <input
                    type="tel"
                    value={editForm.mobile}
                    onChange={(e) => handleEditChange('mobile', e.target.value)}
                    required
                    className={inputClass}
                  />
                  {fieldErrors.mobile && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.mobile}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    અન્ય મોબાઇલ / Alt Mobile
                  </label>
                  <input
                    type="tel"
                    value={editForm.altMobile}
                    onChange={(e) => handleEditChange('altMobile', e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    વ્હોટ્સએપ / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={editForm.whatsapp}
                    onChange={(e) => handleEditChange('whatsapp', e.target.value)}
                    className={inputClass}
                  />
                  {fieldErrors.whatsapp && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.whatsapp}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    અપેક્ષિત સંપર્કો / Expected Contacts
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.expectedContacts}
                    onChange={(e) => handleEditChange('expectedContacts', e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    સરનામું / Address
                  </label>
                  <textarea
                    value={editForm.address}
                    onChange={(e) => handleEditChange('address', e.target.value)}
                    required
                    rows={3}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    મંડળ / Mandal
                  </label>
                  <input
                    type="text"
                    value={editForm.mandal}
                    onChange={(e) => handleEditChange('mandal', e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    ક્ષેત્ર / Kshetra
                  </label>
                  <input
                    type="text"
                    value={editForm.kshetra}
                    onChange={(e) => handleEditChange('kshetra', e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              {editError && (
                <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{editError}</div>
              )}

              <button
                type="submit"
                disabled={isSavingEdit}
                className="w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingEdit ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 size={18} className="animate-spin" />
                    Saving...
                  </span>
                ) : (
                  'Save Changes'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
