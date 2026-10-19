import {
  useEffect,
  useState,
  type FormEvent,
  type ReactElement,
} from 'react';
import {
  AlertCircle,
  Check,
  Eye,
  FileSpreadsheet,
  Loader2,
  Pencil,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import api from '../api/axios';
import PaginationControls from '../components/common/PaginationControls';
import SevakBookDetailsModal from '../components/sevak/SevakBookDetailsModal';
import type { AxiosError } from 'axios';
import type { ApiError } from '../types/auth';
import type { UpdateSevakRequest } from '../types/sevak';

export interface BookRecordSevak {
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
  createdAt: string;
  updatedAt: string;
  totalAllocatedCount: number;
  submittedCount: number;
  partialCount: number;
  stillAssignedCount: number;
  totalSevaAmount: number;
  submittedBooks: Array<{
    bookNumber: string;
    receiptCount: number;
    totalAmount: number;
    sahSevakName: string | null;
    sahSevakMobile: string | null;
    receipts: Array<{
      id: string;
      bookNumber: string;
      receiptNo: string;
      donorName: string;
      donorMobile: string;
      amount: number;
      entryDate: string;
    }>;
  }>;
  partialBooks: Array<{
    bookNumber: string;
    receiptCount: number;
    remainingCount: number;
    totalAmount: number;
    sahSevakName: string | null;
    sahSevakMobile: string | null;
    receipts: Array<{
      id: string;
      bookNumber: string;
      receiptNo: string;
      donorName: string;
      donorMobile: string;
      amount: number;
      entryDate: string;
    }>;
  }>;
  assignedOnlyBooks: Array<{
    bookNumber: string;
    receiptCount: number;
    sahSevakName: string | null;
    sahSevakMobile: string | null;
  }>;
}

interface BookRecordsResponse {
  success: boolean;
  data: BookRecordSevak[];
  pagination: {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
  };
}

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

function sevakToFormState(sevak: BookRecordSevak): FormState {
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

function CountBadge({ count, color }: { count: number; color: 'blue' | 'emerald' | 'amber' | 'slate' }): ReactElement {
  const styles: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
  };

  if (count === 0) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${styles[color]}`}>
      {count}
    </span>
  );
}

export default function SevakBookRecords(): ReactElement {
  const [query, setQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [sevaks, setSevaks] = useState<BookRecordSevak[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const [editingSevak, setEditingSevak] = useState<BookRecordSevak | null>(null);
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
  const [detailSevak, setDetailSevak] = useState<BookRecordSevak | null>(null);
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
        const response = await api.get<BookRecordsResponse>('/api/v1/sevaks/book-records', {
          params: { search: debouncedQuery, page, limit: pageSize },
        });
        setSevaks(response.data.data);
        setTotal(response.data.pagination.totalCount);
      } catch (err) {
        setError(
          (err as AxiosError<ApiError>).response?.data?.error ?? 'Failed to load book records'
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

  const refreshData = async (): Promise<void> => {
    try {
      const response = await api.get<BookRecordsResponse>('/api/v1/sevaks/book-records', {
        params: { search: debouncedQuery, page, limit: pageSize },
      });
      setSevaks(response.data.data);
      setTotal(response.data.pagination.totalCount);
    } catch (err) {
      setError(
        (err as AxiosError<ApiError>).response?.data?.error ?? 'Failed to refresh records'
      );
    }
  };

  const handleDownload = async (): Promise<void> => {
    setIsExporting(true);
    try {
      const response = await api.get('/api/v1/sevaks/export/book-records', {
        responseType: 'blob',
        params: { search: debouncedQuery },
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
      a.download = 'Sevak_Book_Records_2026.xlsx';
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

  const openDetails = (sevak: BookRecordSevak): void => {
    setDetailSevak(sevak);
  };

  const openEdit = (sevak: BookRecordSevak): void => {
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
      await api.put(`/api/v1/sevaks/${editingSevak.id}`, payload);
      setAlert({ type: 'success', message: 'Sevak updated successfully' });
      setEditingSevak(null);
      await refreshData();
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

  const handleDelete = async (sevak: BookRecordSevak): Promise<void> => {
    if (
      !window.confirm(
        `Are you sure you want to delete ${sevak.fullName} (${sevak.sevakCode})? This action cannot be undone.`
      )
    ) {
      return;
    }

    setDeletingId(sevak.id);
    try {
      await api.delete(`/api/v1/sevaks/${sevak.id}`);
      setAlert({ type: 'success', message: 'Sevak deleted successfully' });
      await refreshData();
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
        <h1 className="text-lg font-bold text-slate-800 sm:text-xl">
          Sevak Book Records / સેવક પુસ્તિકા વિગતો
        </h1>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, code, mandal, mobile"
              className={`${inputClass} pl-10`}
            />
          </div>
          <button
            onClick={handleDownload}
            disabled={isExporting}
            className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExporting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <FileSpreadsheet size={16} />
            )}
            <span className="hidden sm:inline">Download Excel</span>
          </button>
        </div>
      </div>

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
        <div className="py-12 text-center text-slate-500">Loading book records...</div>
      ) : sevaks.length === 0 ? (
        <div className="py-12 text-center text-slate-500">
          No book records found{query ? ' for this search' : ''}.
        </div>
      ) : (
        <>
          <div className="mb-2 text-sm text-slate-500">
            Showing {sevaks.length} of {total} record{total === 1 ? '' : 's'}
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Full Name</th>
                  <th className="px-4 py-3 font-medium">Mobile / Mandal</th>
                  <th className="px-4 py-3 font-medium">Total Allocated</th>
                  <th className="px-4 py-3 font-medium">Submitted</th>
                  <th className="px-4 py-3 font-medium">Partially Submitted</th>
                  <th className="px-4 py-3 font-medium">Still Assigned</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sevaks.map((sevak) => (
                  <tr
                    key={sevak.id}
                    onClick={() => openDetails(sevak)}
                    className="cursor-pointer hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-amber-50 px-2 py-1 font-mono text-sm font-bold text-amber-600">
                        {sevak.sevakCode}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{sevak.fullName}</td>
                    <td className="px-4 py-3">
                      <div className="text-slate-700">{sevak.mobile}</div>
                      <div className="text-xs text-slate-500">
                        {sevak.mandal} &middot; {sevak.kshetra}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <CountBadge count={sevak.totalAllocatedCount} color="blue" />
                    </td>
                    <td className="px-4 py-3">
                      <CountBadge count={sevak.submittedCount} color="emerald" />
                    </td>
                    <td className="px-4 py-3">
                      <CountBadge count={sevak.partialCount} color="amber" />
                    </td>
                    <td className="px-4 py-3">
                      <CountBadge count={sevak.stillAssignedCount} color="slate" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openDetails(sevak)}
                          className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50"
                          title="View details"
                        >
                          <Eye size={16} />
                        </button>
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
        </>
      )}

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

      {detailSevak && (
        <SevakBookDetailsModal
          sevak={detailSevak}
          onClose={() => setDetailSevak(null)}
        />
      )}
    </div>
  );
}
