import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ReactElement,
} from 'react';
import {
  AlertCircle,
  Check,
  Gift,
  Loader2,
  Minus,
  Plus,
  Search,
  X,
} from 'lucide-react';
import api from '../../api/axios';
import type { AxiosError } from 'axios';
import type { ApiError } from '../../types/auth';
import type { Sevak, SevakSearchResponse } from '../../types/sevak';

export interface GiftSevakContext {
  sevakId: string;
  sevakCode: string;
  sevakName: string;
  sahSevakName?: string | null;
  sahSevakMobile?: string | null;
}

interface AllocateGiftModalProps {
  initialSevak?: GiftSevakContext | null;
  onClose: () => void;
  onSaved: () => void;
}

interface AssignedBookLite {
  bookNumber: string;
  sahSevakName: string | null;
  sahSevakMobile: string | null;
}

type SevakWithBooks = Sevak & { assignedBooks?: AssignedBookLite[] };

interface SelectedSevak {
  sevakId: string;
  sevakCode: string;
  sevakName: string;
  sahSevakNames: string[];
}

interface GiftRecord {
  id: string;
  recipientType: string;
  recipientName: string;
  biscuitBoxesGiven: number;
  chocolateBoxesGiven: number;
  allocatedAt: string;
  allocatedBy: string | null;
  notes: string | null;
}

type RecipientType = 'SEVAK' | 'SAH_SEVAK';

function QtyStepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}): ReactElement {
  const clamp = (v: number): number => Math.max(0, Number.isNaN(v) ? 0 : v);
  return (
    <div className="rounded-lg border border-rose-100 bg-rose-50/50 p-3">
      <p className="mb-2 text-center text-sm font-medium text-slate-700">{label}</p>
      <div className="flex items-center justify-center gap-1">
        <button
          type="button"
          onClick={() => onChange(clamp(value - 1))}
          disabled={value <= 0}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40"
          aria-label={`Decrease ${label}`}
        >
          <Minus size={14} />
        </button>
        <input
          type="number"
          min={0}
          value={value}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange(clamp(parseInt(e.target.value, 10)))
          }
          className="h-8 w-16 min-w-[60px] shrink-0 rounded-lg border border-gray-200 bg-white text-center text-base font-semibold focus:outline-none focus:ring-1 focus:ring-rose-500 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => onChange(clamp(value + 1))}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
          aria-label={`Increase ${label}`}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}

export default function AllocateGiftModal({
  initialSevak,
  onClose,
  onSaved,
}: AllocateGiftModalProps): ReactElement {
  const [selectedSevak, setSelectedSevak] = useState<SelectedSevak | null>(
    initialSevak
      ? {
          sevakId: initialSevak.sevakId,
          sevakCode: initialSevak.sevakCode,
          sevakName: initialSevak.sevakName,
          sahSevakNames: initialSevak.sahSevakName ? [initialSevak.sahSevakName] : [],
        }
      : null
  );
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<SevakWithBooks[]>([]);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const [recipientType, setRecipientType] = useState<RecipientType>('SEVAK');
  const [recipientName, setRecipientName] = useState<string>(
    initialSevak?.sevakName ?? ''
  );
  const [biscuit, setBiscuit] = useState<number>(0);
  const [chocolate, setChocolate] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [history, setHistory] = useState<GiftRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(
    Boolean(initialSevak)
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!query.trim() || selectedSevak) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get<SevakSearchResponse>('/api/v1/sevaks/search', {
          params: { q: query.trim(), page: 1, limit: 6 },
        });
        setResults(data.sevaks as SevakWithBooks[]);
        setShowDropdown(true);
      } catch {
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query, selectedSevak]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!selectedSevak) {
      return;
    }

    let cancelled = false;
    api
      .get<{ success: boolean; data: GiftRecord[] }>(
        `/api/v1/prasad/gifts/sevak/${selectedSevak.sevakId}`
      )
      .then(({ data }) => {
        if (!cancelled) setHistory(data.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setHistory([]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSevak]);

  const pickSevak = (sevak: SevakWithBooks): void => {
    const sahNames = Array.from(
      new Set(
        (sevak.assignedBooks ?? [])
          .map((b) => b.sahSevakName?.trim())
          .filter((n): n is string => Boolean(n))
      )
    );
    setSelectedSevak({
      sevakId: sevak.id,
      sevakCode: sevak.sevakCode,
      sevakName: sevak.fullName,
      sahSevakNames: sahNames,
    });
    setRecipientType('SEVAK');
    setRecipientName(sevak.fullName);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
    setIsSearching(false);
    setHistory([]);
    setHistoryLoading(true);
    setError('');
  };

  const clearSevak = (): void => {
    setSelectedSevak(null);
    setRecipientName('');
    setRecipientType('SEVAK');
    setHistory([]);
    setHistoryLoading(false);
    setIsSearching(false);
    setResults([]);
    setError('');
  };

  const handleTypeChange = (type: RecipientType): void => {
    setRecipientType(type);
    if (!selectedSevak) return;
    setRecipientName(
      type === 'SEVAK' ? selectedSevak.sevakName : (selectedSevak.sahSevakNames[0] ?? '')
    );
    setError('');
  };

  const totalBoxes = biscuit + chocolate;

  const handleConfirm = async (): Promise<void> => {
    if (!selectedSevak) {
      setError('Select a sevak first.');
      return;
    }
    if (!recipientName.trim()) {
      setError('Recipient name is required.');
      return;
    }
    if (totalBoxes === 0) {
      setError('Enter at least one biscuit or chocolate box.');
      return;
    }

    setIsSaving(true);
    setError('');
    try {
      await api.post('/api/v1/prasad/gifts/allocate', {
        sevakId: selectedSevak.sevakId,
        sevakCode: selectedSevak.sevakCode,
        recipientType,
        recipientName: recipientName.trim(),
        biscuitBoxesGiven: biscuit,
        chocolateBoxesGiven: chocolate,
        notes: notes.trim() || undefined,
      });
      onSaved();
    } catch (err) {
      const message =
        (err as AxiosError<ApiError>).response?.data?.error ??
        'Failed to allocate gift.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-rose-500';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center">
      <div className="my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-800">
              <Gift size={20} className="text-rose-600" />
              Allocate Gift / ભેટ આપો
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Volunteer gift: biscuit &amp; chocolate boxes for sevak or sah-sevak.
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
          {selectedSevak ? (
            <div className="flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50/60 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  <span className="mr-2 rounded-md bg-amber-50 px-2 py-0.5 font-mono text-xs font-bold text-amber-600">
                    {selectedSevak.sevakCode}
                  </span>
                  {selectedSevak.sevakName}
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Sah-Sevak:{' '}
                  {selectedSevak.sahSevakNames.length > 0
                    ? selectedSevak.sahSevakNames.join(', ')
                    : 'None'}
                </p>
              </div>
              {!initialSevak && (
                <button
                  type="button"
                  onClick={clearSevak}
                  className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                >
                  <X size={12} />
                  Change
                </button>
              )}
            </div>
          ) : (
            <div ref={searchRef} className="relative">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Sevak / Sah-Sevak Code / Name / Mobile (સેવક / સહ-સેવક શોધો)
              </label>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={16}
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    const value = e.target.value;
                    setQuery(value);
                    setShowDropdown(true);
                    if (value.trim()) {
                      setIsSearching(true);
                    } else {
                      setResults([]);
                      setIsSearching(false);
                    }
                  }}
                  onFocus={() => setShowDropdown(results.length > 0)}
                  placeholder="Search by sevak code, mobile, name, or sah-sevak"
                  className={`${inputClass} pl-9`}
                />
                {isSearching && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    Loading...
                  </span>
                )}
              </div>
              {showDropdown && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
                  {results.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-slate-500">
                      {query.trim() ? 'No sevaks found' : 'Start typing to search'}
                    </div>
                  ) : (
                    results.map((sevak) => (
                      <button
                        key={sevak.id}
                        type="button"
                        onClick={() => pickSevak(sevak)}
                        className="w-full px-4 py-3 text-left text-sm hover:bg-slate-50"
                      >
                        <span className="font-semibold text-orange-700">
                          {sevak.sevakCode}
                        </span>
                        <span className="ml-2 text-slate-700">{sevak.fullName}</span>
                        <span className="ml-2 block text-xs text-slate-500 sm:inline">
                          {sevak.mobile} &middot; {sevak.mandal}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {selectedSevak && (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-2 text-sm font-semibold text-slate-700">
                  Recipient / ભેટ કોને આપવી
                </p>
                <div className="flex flex-wrap gap-2">
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      recipientType === 'SEVAK'
                        ? 'border-rose-300 bg-rose-50 font-semibold text-rose-800'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="gift-recipient"
                      checked={recipientType === 'SEVAK'}
                      onChange={() => handleTypeChange('SEVAK')}
                      className="accent-rose-600"
                    />
                    Sevak: {selectedSevak.sevakName}
                  </label>
                  <label
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                      recipientType === 'SAH_SEVAK'
                        ? 'border-rose-300 bg-rose-50 font-semibold text-rose-800'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="gift-recipient"
                      checked={recipientType === 'SAH_SEVAK'}
                      onChange={() => handleTypeChange('SAH_SEVAK')}
                      className="accent-rose-600"
                    />
                    Sah-Sevak: {selectedSevak.sahSevakNames[0] ?? 'Sah-Sevak'}
                  </label>
                </div>
                <div className="mt-3">
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Recipient Name (નામ)
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => {
                      setRecipientName(e.target.value);
                      setError('');
                    }}
                    placeholder="Name of person receiving the gift"
                    className={inputClass}
                  />
                  {recipientType === 'SAH_SEVAK' &&
                    selectedSevak.sahSevakNames.length > 1 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedSevak.sahSevakNames.map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => setRecipientName(name)}
                            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                              recipientName === name
                                ? 'bg-rose-100 text-rose-800 ring-rose-300'
                                : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <QtyStepper
                  label="Biscuit Box / બિસ્કિટ બોક્સ"
                  value={biscuit}
                  onChange={(v) => {
                    setBiscuit(v);
                    setError('');
                  }}
                />
                <QtyStepper
                  label="Chocolate Box / ચોકલેટ બોક્સ"
                  value={chocolate}
                  onChange={(v) => {
                    setChocolate(v);
                    setError('');
                  }}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Notes / Remarks (નોંધ) — optional
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any remark for this gift"
                  className={inputClass}
                />
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-slate-600">
                  Previous Gifts / પહેલાંની ભેટ
                </p>
                {historyLoading ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">
                    Loading history...
                  </p>
                ) : history.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-400">
                    No gifts allocated to this sevak yet.
                  </p>
                ) : (
                  <div className="max-h-36 space-y-1.5 overflow-y-auto pr-1">
                    {history.map((gift) => (
                      <div
                        key={gift.id}
                        className="rounded-lg border border-rose-100 bg-rose-50/40 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-slate-700">
                            {gift.recipientName}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              gift.recipientType === 'SEVAK'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            }`}
                          >
                            {gift.recipientType === 'SEVAK' ? 'Sevak' : 'Sah-Sevak'}
                          </span>
                        </div>
                        <p className="mt-0.5 text-slate-500">
                          Biscuit: {gift.biscuitBoxesGiven} · Chocolate:{' '}
                          {gift.chocolateBoxesGiven} ·{' '}
                          {new Date(gift.allocatedAt).toLocaleString('en-IN')}
                          {gift.allocatedBy ? ` · by ${gift.allocatedBy}` : ''}
                        </p>
                        {gift.notes && (
                          <p className="mt-0.5 text-slate-400">Note: {gift.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <p className="text-sm text-slate-600">
              Total boxes: <span className="font-bold text-slate-800">{totalBoxes}</span>
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
                disabled={isSaving || !selectedSevak || totalBoxes === 0}
                className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Check size={16} />
                )}
                Confirm &amp; Allocate / ભેટ આપો
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
