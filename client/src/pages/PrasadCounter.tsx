import {
  useEffect,
  useState,
  type ChangeEvent,
  type ReactElement,
} from 'react';
import {
  AlertCircle,
  Check,
  FileSpreadsheet,
  HandHeart,
  Loader2,
  Minus,
  Package,
  Plus,
  Search,
  X,
} from 'lucide-react';
import api from '../api/axios';
import PaginationControls from '../components/common/PaginationControls';
import type { AxiosError } from 'axios';
import type { ApiError } from '../types/auth';

interface PrasadItemCounts {
  small: number;
  big: number;
  biscuit: number;
  chocolate: number;
}

type ItemKey = keyof PrasadItemCounts;

interface PrasadBookRow {
  sevakId: string;
  sevakCode: string;
  sevakName: string;
  sevakMobile: string;
  mandal: string;
  kshetra: string;
  bookNumber: string;
  bookStatus: string;
  sahSevakName: string | null;
  sahSevakMobile: string | null;
  receiptCount: number;
  eligible: PrasadItemCounts;
  distributed: PrasadItemCounts;
  remaining: PrasadItemCounts;
  collectedByName: string | null;
  collectedByMobile: string | null;
  distributedBy: string | null;
  distributedAt: string | null;
  notes: string | null;
  status: 'PENDING' | 'COMPLETED';
}

interface ItemTotals {
  eligible: number;
  given: number;
  remaining: number;
}

interface PrasadSummaryResponse {
  success: boolean;
  data: PrasadBookRow[];
  summary: {
    smallBox: ItemTotals;
    bigBox: ItemTotals;
    biscuitBox: ItemTotals;
    chocolateBox: ItemTotals;
  };
  mandals: string[];
  pagination: {
    totalCount: number;
    totalPages: number;
    currentPage: number;
    pageSize: number;
  };
}

interface AlertState {
  type: 'success' | 'error';
  message: string;
}

type StatusTab = 'ALL' | 'PENDING' | 'COMPLETED';

const ITEM_META: Array<{
  key: ItemKey;
  summaryKey: 'smallBox' | 'bigBox' | 'biscuitBox' | 'chocolateBox';
  label: string;
  gujarati: string;
  cardClass: string;
}> = [
  {
    key: 'small',
    summaryKey: 'smallBox',
    label: 'Small Box',
    gujarati: 'નાનો બોક્સ',
    cardClass: 'border-sky-100 bg-sky-50 text-sky-700',
  },
  {
    key: 'big',
    summaryKey: 'bigBox',
    label: 'Big Box',
    gujarati: 'મોટો બોક્સ',
    cardClass: 'border-orange-100 bg-orange-50 text-orange-700',
  },
  {
    key: 'biscuit',
    summaryKey: 'biscuitBox',
    label: 'Biscuit Box',
    gujarati: 'બિસ્કિટ બોક્સ',
    cardClass: 'border-amber-100 bg-amber-50 text-amber-700',
  },
  {
    key: 'chocolate',
    summaryKey: 'chocolateBox',
    label: 'Chocolate Box',
    gujarati: 'ચોકલેટ બોક્સ',
    cardClass: 'border-purple-100 bg-purple-50 text-purple-700',
  },
];

function ItemBadge({
  label,
  eligible,
  given,
  remaining,
}: {
  label: string;
  eligible: number;
  given: number;
  remaining: number;
}): ReactElement {
  const empty = eligible === 0;
  return (
    <div
      className={`min-w-[130px] rounded-lg border px-3 py-2 ${
        empty
          ? 'border-slate-100 bg-slate-50 text-slate-400'
          : 'border-slate-200 bg-white text-slate-700'
      }`}
    >
      <p className={`text-xs font-semibold ${empty ? 'text-slate-400' : 'text-slate-800'}`}>
        {label}
      </p>
      <p className="mt-0.5 text-xs">
        Eligible: {eligible} | Given: {given} | Rem: {remaining}
      </p>
    </div>
  );
}

function QtyStepper({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  onChange: (next: number) => void;
}): ReactElement {
  const clamp = (v: number): number => Math.min(max, Math.max(0, Number.isNaN(v) ? 0 : v));
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <span className="text-xs text-slate-500">max {max}</span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= 0}
          className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Decrease ${label}`}
        >
          <Minus size={14} />
        </button>
        <input
          type="number"
          min={0}
          max={max}
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange(clamp(parseInt(e.target.value, 10)))
          }
          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-center text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          disabled={value >= max}
          className="rounded-lg border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Increase ${label}`}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

interface DistributeModalProps {
  row: PrasadBookRow;
  onClose: () => void;
  onSaved: () => void;
}

function DistributeModal({ row, onClose, onSaved }: DistributeModalProps): ReactElement {
  const [collectedByName, setCollectedByName] = useState<string>('');
  const [collectedByMobile, setCollectedByMobile] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [quantities, setQuantities] = useState<PrasadItemCounts>({
    small: 0,
    big: 0,
    biscuit: 0,
    chocolate: 0,
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const totalToGive =
    quantities.small + quantities.big + quantities.biscuit + quantities.chocolate;
  const mobileDigits = collectedByMobile.replace(/\D/g, '');

  const setQty = (key: ItemKey, value: number): void => {
    setQuantities((prev) => ({ ...prev, [key]: value }));
    setError('');
  };

  const fillAll = (): void => {
    setQuantities({ ...row.remaining });
    setError('');
  };

  const useSevak = (): void => {
    setCollectedByName(row.sevakName);
    setCollectedByMobile(row.sevakMobile);
  };

  const useSahSevak = (): void => {
    setCollectedByName(row.sahSevakName ?? '');
    setCollectedByMobile(row.sahSevakMobile ?? '');
  };

  const handleConfirm = async (): Promise<void> => {
    if (totalToGive === 0) {
      setError('Enter at least one item quantity to distribute.');
      return;
    }
    if (collectedByMobile.trim() && mobileDigits.length < 10) {
      setError('Collected-by mobile must contain at least 10 digits.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await api.post('/api/v1/prasad/distribute', {
        sevakId: row.sevakId,
        bookNumber: row.bookNumber,
        distributedSmall: quantities.small,
        distributedBig: quantities.big,
        distributedBiscuit: quantities.biscuit,
        distributedChocolate: quantities.chocolate,
        collectedByName: collectedByName.trim() || undefined,
        collectedByMobile: collectedByMobile.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      onSaved();
    } catch (err) {
      const message =
        (err as AxiosError<ApiError>).response?.data?.error ??
        'Failed to record distribution.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center">
      <div className="my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              Distribute Prasad / પ્રસાદ આપો
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              <span className="font-mono font-semibold text-amber-600">{row.sevakCode}</span>{' '}
              {row.sevakName} · Book{' '}
              <span className="font-semibold text-slate-700">{row.bookNumber}</span>
              {row.sahSevakName && (
                <>
                  {' '}
                  · Sah-Sevak: {row.sahSevakName}
                  {row.sahSevakMobile ? ` (${row.sahSevakMobile})` : ''}
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-700">
              Collected By / સંગ્રહ કરનાર
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Collected By Name (સંગ્રહ કરનારનું નામ)
                </label>
                <input
                  type="text"
                  value={collectedByName}
                  onChange={(e) => setCollectedByName(e.target.value)}
                  placeholder="Name of person picking up"
                  className={inputClass}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={useSevak}
                    className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                  >
                    Use Sevak Name
                  </button>
                  {row.sahSevakName && (
                    <button
                      type="button"
                      onClick={useSahSevak}
                      className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                    >
                      Use Sah-Sevak Name
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Collected By Mobile (મોબાઇલ નંબર)
                </label>
                <input
                  type="tel"
                  value={collectedByMobile}
                  onChange={(e) => setCollectedByMobile(e.target.value)}
                  placeholder="10-digit mobile"
                  maxLength={14}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Items to Give / આપવાની વસ્તુઓ</p>
              <button
                type="button"
                onClick={fillAll}
                className="rounded-lg bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100"
              >
                Fill All Remaining / બધું બાકી આપો
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <QtyStepper
                label="Small Box"
                value={quantities.small}
                max={row.remaining.small}
                onChange={(v) => setQty('small', v)}
              />
              <QtyStepper
                label="Big Box"
                value={quantities.big}
                max={row.remaining.big}
                onChange={(v) => setQty('big', v)}
              />
              <QtyStepper
                label="Biscuit Box"
                value={quantities.biscuit}
                max={row.remaining.biscuit}
                onChange={(v) => setQty('biscuit', v)}
              />
              <QtyStepper
                label="Chocolate Box"
                value={quantities.chocolate}
                max={row.remaining.chocolate}
                onChange={(v) => setQty('chocolate', v)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Notes (નોંધ) — optional
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any remark for this handover"
              className={inputClass}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-600">
              Total items: <span className="font-bold text-slate-800">{totalToGive}</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSaving || totalToGive === 0}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                Confirm & Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PrasadCounter(): ReactElement {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedMandal, setSelectedMandal] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'COMPLETED'>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [rows, setRows] = useState<PrasadBookRow[]>([]);
  const [summary, setSummary] = useState<PrasadSummaryResponse['summary'] | null>(null);
  const [mandals, setMandals] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [activeRow, setActiveRow] = useState<PrasadBookRow | null>(null);

  const hasActiveSearch = Boolean(
    searchQuery.trim() || selectedMandal !== 'ALL' || statusFilter !== 'ALL'
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    async function load(): Promise<void> {
      setIsLoading(true);
      setError('');
      try {
        const response = await api.get<PrasadSummaryResponse>('/api/v1/prasad/summary', {
          params: {
            search: debouncedQuery || undefined,
            mandal: selectedMandal === 'ALL' ? undefined : selectedMandal,
            status: statusFilter,
            page,
            limit: pageSize,
          },
        });
        const activeSearch = Boolean(
          debouncedQuery || selectedMandal !== 'ALL' || statusFilter !== 'ALL'
        );
        setRows(activeSearch ? response.data.data : []);
        setSummary(response.data.summary);
        setMandals(response.data.mandals);
        setTotal(response.data.pagination.totalCount);
      } catch (err) {
        setError(
          (err as AxiosError<ApiError>).response?.data?.error ??
            'Failed to load prasad summary'
        );
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [debouncedQuery, selectedMandal, statusFilter, page, pageSize]);

  useEffect(() => {
    if (!alert) return;
    const timer = setTimeout(() => setAlert(null), 5000);
    return () => clearTimeout(timer);
  }, [alert]);

  const refreshData = async (): Promise<void> => {
    try {
      const response = await api.get<PrasadSummaryResponse>('/api/v1/prasad/summary', {
        params: {
          search: debouncedQuery || undefined,
          mandal: selectedMandal === 'ALL' ? undefined : selectedMandal,
          status: statusFilter,
          page,
          limit: pageSize,
        },
      });
      const activeSearch = Boolean(
        debouncedQuery || selectedMandal !== 'ALL' || statusFilter !== 'ALL'
      );
      setRows(activeSearch ? response.data.data : []);
      setSummary(response.data.summary);
      setTotal(response.data.pagination.totalCount);
    } catch (err) {
      setError(
        (err as AxiosError<ApiError>).response?.data?.error ?? 'Failed to refresh records'
      );
    }
  };

  const handleExport = async (): Promise<void> => {
    setIsExporting(true);
    try {
      const response = await api.get('/api/v1/prasad/export', {
        responseType: 'blob',
        params: {
          search: debouncedQuery || undefined,
          mandal: selectedMandal === 'ALL' ? undefined : selectedMandal,
          status: statusFilter,
        },
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
      a.download = 'Prasad_Vitran_Records_2026.xlsx';
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

  const remainingTotal = (row: PrasadBookRow): number =>
    row.remaining.small + row.remaining.big + row.remaining.biscuit + row.remaining.chocolate;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500';

  const tabs: Array<{ key: StatusTab; label: string }> = [
    { key: 'ALL', label: 'All' },
    { key: 'PENDING', label: 'Pending (બાકી)' },
    { key: 'COMPLETED', label: 'Completed (પૂર્ણ)' },
  ];

  return (
    <div className="space-y-4 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-bold text-slate-800 sm:text-xl">
            <HandHeart size={22} className="text-orange-600" />
            Prasad Vitran Counter / પ્રસાદ વિતરણ કાઉન્ટર
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Live book-level prasad eligibility and distribution desk.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="flex items-center justify-center gap-1.5 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isExporting ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <FileSpreadsheet size={16} />
          )}
          Download Excel
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ITEM_META.map((meta) => {
          const totals = summary?.[meta.summaryKey] ?? { eligible: 0, given: 0, remaining: 0 };
          return (
            <div
              key={meta.key}
              className={`rounded-xl border p-4 ${meta.cardClass}`}
            >
              <div className="flex items-center gap-2">
                <Package size={16} />
                <p className="text-xs font-semibold uppercase tracking-wide">
                  {meta.label}
                </p>
              </div>
              <p className="mt-0.5 text-[11px] opacity-80">{meta.gujarati}</p>
              <div className="mt-3 grid grid-cols-3 gap-1 text-center">
                <div>
                  <p className="text-[10px] uppercase opacity-70">Eligible</p>
                  <p className="text-lg font-bold">{totals.eligible}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase opacity-70">Given</p>
                  <p className="text-lg font-bold">{totals.given}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase opacity-70">Rem</p>
                  <p className="text-lg font-bold">{totals.remaining}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sevak code / name, mobile, sah-sevak, book no."
            className={`${inputClass} pl-10`}
          />
        </div>
        <select
          value={selectedMandal}
          onChange={(e) => {
            setSelectedMandal(e.target.value);
            setPage(1);
          }}
          className={`${inputClass} lg:w-56`}
          aria-label="Filter by mandal"
        >
          <option value="ALL">All Mandals</option>
          {mandals.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <div className="flex rounded-lg bg-slate-100 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setStatusFilter(tab.key);
                setPage(1);
              }}
              className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition sm:text-sm ${
                statusFilter === tab.key
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {alert && (
        <div
          className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
            alert.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          }`}
        >
          {alert.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          {alert.message}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {hasActiveSearch ? (
        isLoading ? (
        <div className="py-12 text-center text-slate-500">Loading prasad records...</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-slate-500">
          No prasad records found for these filters.
        </div>
      ) : (
        <>
          <div className="text-sm text-slate-500">
            Showing {rows.length} of {total} book{total === 1 ? '' : 's'}
          </div>

          <div className="space-y-3">
            {rows.map((row) => {
              const isComplete = row.status === 'COMPLETED';
              return (
                <div
                  key={`${row.sevakId}-${row.bookNumber}`}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-[220px]">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-amber-50 px-2 py-1 font-mono text-sm font-bold text-amber-600">
                          {row.sevakCode}
                        </span>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            isComplete
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {isComplete ? 'Completed' : 'Pending'}
                        </span>
                      </div>
                      <p className="mt-1.5 font-semibold text-slate-800">{row.sevakName}</p>
                      <p className="text-xs text-slate-500">
                        {row.sevakMobile} · {row.mandal} · {row.kshetra}
                      </p>
                    </div>

                    <div className="min-w-[180px]">
                      <p className="text-sm">
                        <span className="rounded-md bg-blue-50 px-2 py-1 font-mono text-sm font-bold text-blue-700">
                          Book {row.bookNumber}
                        </span>
                        <span className="ml-2 text-xs text-slate-500">
                          {row.receiptCount} receipt{row.receiptCount === 1 ? '' : 's'}
                        </span>
                      </p>
                      <p className="mt-1.5 text-xs text-slate-500">
                        Sah-Sevak:{' '}
                        {row.sahSevakName ? (
                          <span className="font-medium text-slate-700">
                            {row.sahSevakName}
                            {row.sahSevakMobile ? ` · ${row.sahSevakMobile}` : ''}
                          </span>
                        ) : (
                          'None'
                        )}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <ItemBadge
                        label="Small Box"
                        eligible={row.eligible.small}
                        given={row.distributed.small}
                        remaining={row.remaining.small}
                      />
                      <ItemBadge
                        label="Big Box"
                        eligible={row.eligible.big}
                        given={row.distributed.big}
                        remaining={row.remaining.big}
                      />
                      <ItemBadge
                        label="Biscuit Box"
                        eligible={row.eligible.biscuit}
                        given={row.distributed.biscuit}
                        remaining={row.remaining.biscuit}
                      />
                      <ItemBadge
                        label="Chocolate Box"
                        eligible={row.eligible.chocolate}
                        given={row.distributed.chocolate}
                        remaining={row.remaining.chocolate}
                      />
                    </div>

                    <div className="min-w-[160px]">
                      <p className="text-xs font-medium uppercase text-slate-400">Collected By</p>
                      {row.collectedByName ? (
                        <p className="mt-0.5 text-sm text-slate-700">
                          {row.collectedByName}
                          {row.collectedByMobile && (
                            <span className="block text-xs text-slate-500">
                              {row.collectedByMobile}
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-sm text-slate-400">—</p>
                      )}
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => setActiveRow(row)}
                        disabled={remainingTotal(row) === 0}
                        className="w-full rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 xl:w-auto"
                      >
                        Distribute / આપો
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
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
      )
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-slate-500">
          <p className="text-base font-medium text-slate-700">Start a search to view details</p>
          <p className="mx-auto mt-1 max-w-2xl text-sm text-slate-500">
            Search by Sevak Code (e.g. nb202605), Name, Mobile, Sah-Sevak, or Book No to view prasad distribution details.
          </p>
        </div>
      )}

      {activeRow && (
        <DistributeModal
          row={activeRow}
          onClose={() => setActiveRow(null)}
          onSaved={() => {
            setActiveRow(null);
            setAlert({ type: 'success', message: 'Prasad distributed successfully' });
            void refreshData();
          }}
        />
      )}
    </div>
  );
}
