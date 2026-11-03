import { useEffect, useState, type ReactElement } from 'react';
import {
  AlertCircle,
  BookCopy,
  ClipboardList,
  Loader2,
  Package,
  Users,
  X,
} from 'lucide-react';
import api from '../../api/axios';
import type { AxiosError } from 'axios';
import type { ApiError } from '../../types/auth';

export interface SlabBreakdown {
  receiptCount: number;
  bag: number;
  small: number;
  big: number;
  biscuit: number;
  chocolate: number;
}

export interface SevakSlabSummary {
  totalReceipts: number;
  totalAmount: number;
  booksCount: number;
  sahSevakNames: string[];
  slab1: SlabBreakdown;
  slab2: SlabBreakdown;
  slab3: SlabBreakdown;
  slab4: SlabBreakdown;
  slab5: SlabBreakdown;
  totalEligible: {
    bag: number;
    small: number;
    big: number;
    biscuit: number;
    chocolate: number;
  };
}

interface SevakSlabSummaryResponse {
  success: boolean;
  sevak: {
    id: string;
    sevakCode: string;
    fullName: string;
    mobile: string;
    mandal: string;
    kshetra: string;
  };
  slabSummary: SevakSlabSummary;
}

type ItemKey = 'bag' | 'small' | 'big' | 'biscuit' | 'chocolate';

type SlabKey = 'slab1' | 'slab2' | 'slab3' | 'slab4' | 'slab5';

const ITEM_PLURAL: Record<ItemKey, string> = {
  bag: 'Bags',
  small: 'Small Boxes',
  big: 'Big Boxes',
  biscuit: 'Biscuit Boxes',
  chocolate: 'Chocolate Boxes',
};

const ITEM_GUJARATI: Record<ItemKey, string> = {
  bag: 'થેલી',
  small: 'નાનો બોક્સ',
  big: 'મોટો બોક્સ',
  biscuit: 'બિસ્કિટ બોક્સ',
  chocolate: 'ચોકલેટ બોક્સ',
};

const SLAB_META: Array<{
  key: SlabKey;
  label: string;
  range: string;
  grants: ItemKey[];
  activeClass: string;
  accentClass: string;
}> = [
  {
    key: 'slab1',
    label: 'Slab 1',
    range: '₹1 - ₹249',
    grants: ['bag'],
    activeClass: 'border-rose-200 bg-rose-50',
    accentClass: 'text-rose-600',
  },
  {
    key: 'slab2',
    label: 'Slab 2',
    range: '₹250 - ₹499',
    grants: ['small'],
    activeClass: 'border-sky-200 bg-sky-50',
    accentClass: 'text-sky-600',
  },
  {
    key: 'slab3',
    label: 'Slab 3',
    range: '₹500 - ₹1,000',
    grants: ['big'],
    activeClass: 'border-amber-200 bg-amber-50',
    accentClass: 'text-amber-600',
  },
  {
    key: 'slab4',
    label: 'Slab 4',
    range: '₹1,001 - ₹4,999',
    grants: ['big', 'biscuit'],
    activeClass: 'border-orange-200 bg-orange-50',
    accentClass: 'text-orange-600',
  },
  {
    key: 'slab5',
    label: 'Slab 5',
    range: '₹5,000 - ₹20,000+',
    grants: ['big', 'biscuit', 'chocolate'],
    activeClass: 'border-purple-200 bg-purple-50',
    accentClass: 'text-purple-600',
  },
];

const TOTAL_ITEMS: Array<{ key: ItemKey; label: string }> = [
  { key: 'bag', label: 'Bags' },
  { key: 'small', label: 'Small Boxes' },
  { key: 'big', label: 'Big Boxes' },
  { key: 'biscuit', label: 'Biscuit Boxes' },
  { key: 'chocolate', label: 'Chocolate Boxes' },
];

function useSevakSlabSummary(sevakId: string): {
  data: SevakSlabSummaryResponse | null;
  isLoading: boolean;
  error: string;
} {
  const [data, setData] = useState<SevakSlabSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      setIsLoading(true);
      setError('');
      try {
        const response = await api.get<SevakSlabSummaryResponse>(
          `/api/v1/prasad/sevak/${sevakId}/slab-summary`
        );
        if (!cancelled) setData(response.data);
      } catch (err) {
        if (!cancelled) {
          setError(
            (err as AxiosError<ApiError>).response?.data?.error ??
              'Failed to load sevak slab summary'
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [sevakId]);

  return { data, isLoading, error };
}

export function SevakSlabSummaryContent({
  summary,
}: {
  summary: SevakSlabSummary;
}): ReactElement {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {SLAB_META.map((slab) => {
          const breakdown = summary[slab.key];
          const active = breakdown.receiptCount > 0;
          return (
            <div
              key={slab.key}
              className={`flex flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-lg border px-3 py-2 text-sm ${
                active
                  ? `${slab.activeClass} font-semibold text-slate-800`
                  : 'border-slate-100 bg-slate-50/60 text-slate-400'
              }`}
            >
              <span className={active ? `font-bold ${slab.accentClass}` : 'font-semibold'}>
                {slab.label}
              </span>
              <span>({slab.range})</span>
              <span className={active ? slab.accentClass : 'text-slate-300'}>:</span>
              <span>
                {breakdown.receiptCount} receipt{breakdown.receiptCount === 1 ? '' : 's'}
              </span>
              <span className={active ? slab.accentClass : 'text-slate-300'}>➔</span>
              <span className={active ? 'font-bold text-slate-800' : ''}>
                {slab.grants
                  .map(
                    (item) =>
                      `${breakdown[item]} ${ITEM_PLURAL[item]} (${ITEM_GUJARATI[item]})`
                  )
                  .join(' + ')}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-amber-300 bg-gradient-to-r from-amber-100 to-orange-100 px-4 py-3 shadow-sm">
        <span className="flex items-center gap-1.5 text-sm font-bold text-amber-800">
          <Package size={15} />
          Total Eligible / કુલ પ્રસાદ:
        </span>
        {TOTAL_ITEMS.map((item) => (
          <span key={item.key} className="text-sm font-semibold text-slate-800">
            {item.label}:{' '}
            <span className="font-bold text-amber-800">
              {summary.totalEligible[item.key]}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function InlineSevakSlabSummary({
  sevakId,
}: {
  sevakId: string;
}): ReactElement {
  const { data, isLoading, error } = useSevakSlabSummary(sevakId);

  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-white/70 p-3">
      {isLoading ? (
        <div className="flex items-center gap-2 py-3 text-sm text-slate-500">
          <Loader2 size={15} className="animate-spin" />
          Loading combined slab summary...
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={15} />
          {error}
        </div>
      ) : data ? (
        <SevakSlabSummaryContent summary={data.slabSummary} />
      ) : null}
    </div>
  );
}

interface SevakPrasadSummaryModalProps {
  sevakId: string;
  fallbackCode?: string;
  fallbackName?: string;
  onClose: () => void;
}

export default function SevakPrasadSummaryModal({
  sevakId,
  fallbackCode,
  fallbackName,
  onClose,
}: SevakPrasadSummaryModalProps): ReactElement {
  const { data, isLoading, error } = useSevakSlabSummary(sevakId);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const sevak = data?.sevak;
  const summary = data?.slabSummary;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
              <ClipboardList size={20} className="text-amber-600" />
              Total Prasad Allocation Details / સેવક અને સહ-સેવક કુલ પ્રસાદ ગણતરી
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              <span className="font-mono font-semibold text-amber-600">
                {sevak?.sevakCode ?? fallbackCode}
              </span>{' '}
              {sevak?.fullName ?? fallbackName}
              {sevak && (
                <>
                  {' '}
                  · {sevak.mandal}
                  {' · '}
                  {sevak.mobile}
                </>
              )}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
              <span className="flex items-center gap-1">
                <BookCopy size={13} className="text-blue-600" />
                Total Books:{' '}
                <span className="font-bold text-slate-800">
                  {summary?.booksCount ?? '—'}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <Users size={13} className="text-emerald-600" />
                Sah-Sevak:{' '}
                <span className="font-semibold text-slate-800">
                  {summary && summary.sahSevakNames.length > 0
                    ? summary.sahSevakNames.join(', ')
                    : 'None'}
                </span>
              </span>
              <span>
                Total Receipts:{' '}
                <span className="font-bold text-slate-800">
                  {summary?.totalReceipts ?? '—'}
                </span>
              </span>
              <span>
                Total Amount:{' '}
                <span className="font-bold text-slate-800">
                  ₹{summary ? summary.totalAmount.toLocaleString('en-IN') : '—'}
                </span>
              </span>
            </div>
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

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
            <Loader2 size={18} className="animate-spin" />
            Loading slab summary...
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle size={16} />
            {error}
          </div>
        ) : summary ? (
          <SevakSlabSummaryContent summary={summary} />
        ) : null}
      </div>
    </div>
  );
}
