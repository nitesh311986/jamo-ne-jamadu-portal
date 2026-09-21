import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement,
} from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, IndianRupee, Plus, Save, Search } from 'lucide-react';
import api from '../api/axios';
import { formatINR } from '../utils/currency';
import type { Sevak } from '../types/sevak';
import type { SevakSearchResponse } from '../types/sevak';
import type { BookAllocation } from '../types/book';
import type { ReceiptInput, ReceiptSummaryResponse } from '../types/receipt';
import type { ApiError } from '../types/auth';
import type { AxiosError } from 'axios';

const initialRow: ReceiptInput = {
  bookNumber: '',
  receiptNo: '',
  donorName: '',
  donorMobile: '',
  amount: '',
};

const fieldOrder: (keyof ReceiptInput)[] = [
  'bookNumber',
  'receiptNo',
  'donorName',
  'donorMobile',
  'amount',
];

export default function ReceiptEntry(): ReactElement {
  const [sevakQuery, setSevakQuery] = useState<string>('');
  const [sevakResults, setSevakResults] = useState<Sevak[]>([]);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [selectedSevak, setSelectedSevak] = useState<Sevak | null>(null);
  const [books, setBooks] = useState<BookAllocation[]>([]);
  const [summary, setSummary] = useState<ReceiptSummaryResponse | null>(null);
  const [rows, setRows] = useState<ReceiptInput[]>([{ ...initialRow }]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const lastRowRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    if (!sevakQuery.trim()) {
      setSevakResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setShowDropdown(true);
      try {
        const { data } = await api.get<SevakSearchResponse>('/api/v1/sevaks/search', {
          params: { q: sevakQuery.trim(), page: 1, limit: 5 },
        });
        setSevakResults(data.sevaks);
      } catch {
        setSevakResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [sevakQuery]);

  useEffect(() => {
    const firstInput = lastRowRef.current?.querySelector('input') as HTMLInputElement | null;
    firstInput?.focus();
  }, [rows.length]);

  const selectSevak = async (sevak: Sevak): Promise<void> => {
    setSelectedSevak(sevak);
    setSevakQuery('');
    setSevakResults([]);
    setShowDropdown(false);
    setRows([{ ...initialRow }]);
    setError('');
    setSuccess('');

    try {
      const [booksRes, summaryRes] = await Promise.all([
        api.get<{ books: BookAllocation[] }>(`/api/v1/books/sevak/${sevak.id}`),
        api.get<ReceiptSummaryResponse>(`/api/v1/receipts/sevak/${sevak.id}/summary`),
      ]);
      setBooks(booksRes.data.books);
      setSummary(summaryRes.data);
    } catch {
      setError('Failed to load sevak details');
    }
  };

  const addRow = (): void => {
    setRows((prev) => [...prev, { ...initialRow }]);
  };

  const updateRow = (
    index: number,
    field: keyof ReceiptInput,
    value: string
  ): void => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    index: number,
    field: keyof ReceiptInput
  ): void => {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    const fieldIndex = fieldOrder.indexOf(field);
    if (fieldIndex < fieldOrder.length - 1) {
      const nextField = fieldOrder[fieldIndex + 1];
      const key = `${index}-${nextField}`;
      inputRefs.current[key]?.focus();
    } else {
      addRow();
    }
  };

  const handleSave = async (): Promise<void> => {
    if (!selectedSevak) {
      setError('Select a sevak first');
      return;
    }

    const receipts = [];
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (!row.bookNumber.trim() && !row.receiptNo.trim() && !row.donorName.trim() && !row.amount) {
        continue;
      }

      if (!row.bookNumber.trim() || !row.receiptNo.trim() || !row.donorName.trim() || !row.amount) {
        setError(`Row ${i + 1} has missing fields`);
        return;
      }

      const amount = Number(row.amount);
      if (Number.isNaN(amount) || amount <= 0) {
        setError(`Row ${i + 1} has an invalid amount`);
        return;
      }

      receipts.push({
        bookNumber: row.bookNumber.trim(),
        receiptNo: row.receiptNo.trim(),
        donorName: row.donorName.trim(),
        donorMobile: row.donorMobile.trim() || null,
        amount,
        entryDate: new Date().toISOString(),
      });
    }

    if (receipts.length === 0) {
      setError('No valid receipts to save');
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/api/v1/receipts', {
        sevakId: selectedSevak.id,
        receipts,
      });

      setSuccess(`${receipts.length} receipt${receipts.length === 1 ? '' : 's'} saved`);
      setRows([{ ...initialRow }]);

      const { data } = await api.get<ReceiptSummaryResponse>(
        `/api/v1/receipts/sevak/${selectedSevak.id}/summary`
      );
      setSummary(data);
    } catch (err) {
      setError(
        (err as AxiosError<ApiError>).response?.data?.error ?? 'Failed to save receipts'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const liveGroups: Record<number, { amount: number; count: number; subTotal: number }> = {};
  let liveTotal = 0;
  for (const row of rows) {
    const amount = Number(row.amount);
    if (!amount || Number.isNaN(amount)) continue;
    if (!liveGroups[amount]) {
      liveGroups[amount] = { amount, count: 0, subTotal: 0 };
    }
    liveGroups[amount].count += 1;
    liveGroups[amount].subTotal += amount;
    liveTotal += amount;
  }
  const sortedGroups = Object.values(liveGroups).sort((a, b) => a.amount - b.amount);

  const inputClass =
    'w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500';

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
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
              Receipt Entry
            </h1>
          </div>
          <Link
            to="/receipts/search"
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            <Search size={16} />
            Search
          </Link>
        </div>

        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={sevakQuery}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setSevakQuery(e.target.value);
                setShowDropdown(true);
              }}
              placeholder="Search sevak by code, phone, or name"
              className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
            />
          </div>

          {showDropdown && sevakResults.length > 0 && (
            <div className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
              {sevakResults.map((sevak) => (
                <button
                  key={sevak.id}
                  type="button"
                  onClick={() => void selectSevak(sevak)}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-slate-50"
                >
                  <span className="font-semibold text-orange-700">{sevak.sevakCode}</span>
                  <span className="ml-2 text-slate-700">{sevak.fullName}</span>
                  <span className="ml-2 text-slate-500">{sevak.mobile}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedSevak && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <BookOpen size={20} className="text-orange-600" />
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {selectedSevak.sevakCode} - {selectedSevak.fullName}
                </p>
                <p className="text-xs text-slate-500">
                  {selectedSevak.mandal} &middot; {selectedSevak.kshetra}
                </p>
                <p className="text-xs text-slate-500">
                  Assigned books: {books.map((b) => b.bookNumber).join(', ') || 'None'}
                </p>
              </div>
            </div>
            {summary && (
              <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-500">Grand Total</p>
                  <p className="text-lg font-bold text-slate-800">{formatINR(summary.grandTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Receipts</p>
                  <p className="text-lg font-bold text-slate-800">{summary.totalCount}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Books</p>
                  <p className="text-lg font-bold text-slate-800">{books.length}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{success}</div>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Book No</th>
                <th className="px-3 py-2 font-medium">Receipt No</th>
                <th className="px-3 py-2 font-medium">Donor Name</th>
                <th className="px-3 py-2 font-medium">Donor Mobile</th>
                <th className="px-3 py-2 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => (
                <tr
                  key={index}
                  ref={index === rows.length - 1 ? lastRowRef : undefined}
                >
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.bookNumber}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        updateRow(index, 'bookNumber', e.target.value)
                      }
                      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) =>
                        handleKeyDown(e, index, 'bookNumber')
                      }
                      ref={(el) => {
                        inputRefs.current[`${index}-bookNumber`] = el;
                      }}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.receiptNo}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        updateRow(index, 'receiptNo', e.target.value)
                      }
                      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) =>
                        handleKeyDown(e, index, 'receiptNo')
                      }
                      ref={(el) => {
                        inputRefs.current[`${index}-receiptNo`] = el;
                      }}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.donorName}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        updateRow(index, 'donorName', e.target.value)
                      }
                      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) =>
                        handleKeyDown(e, index, 'donorName')
                      }
                      ref={(el) => {
                        inputRefs.current[`${index}-donorName`] = el;
                      }}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="text"
                      value={row.donorMobile}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        updateRow(index, 'donorMobile', e.target.value)
                      }
                      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) =>
                        handleKeyDown(e, index, 'donorMobile')
                      }
                      ref={(el) => {
                        inputRefs.current[`${index}-donorMobile`] = el;
                      }}
                      className={inputClass}
                    />
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={row.amount}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        updateRow(index, 'amount', e.target.value)
                      }
                      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) =>
                        handleKeyDown(e, index, 'amount')
                      }
                      ref={(el) => {
                        inputRefs.current[`${index}-amount`] = el;
                      }}
                      className={inputClass}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addRow}
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            <Plus size={16} />
            Add Row
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving || !selectedSevak}
            className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={16} />
            {isSaving ? 'Saving...' : 'Save Receipts'}
          </button>
        </div>
      </div>

      <div className="lg:sticky lg:top-24 lg:col-span-1 lg:self-start">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <IndianRupee size={18} className="text-orange-600" />
            <h2 className="font-bold text-slate-800">Live Calculation</h2>
          </div>

          {sortedGroups.length === 0 ? (
            <p className="text-sm text-slate-500">Enter amounts to see the breakdown.</p>
          ) : (
            <div className="space-y-2">
              {sortedGroups.map((group) => (
                <div
                  key={group.amount}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-600">
                    {formatINR(group.amount)} × {group.count}
                  </span>
                  <span className="font-semibold text-slate-800">
                    {formatINR(group.subTotal)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 border-t border-slate-100 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">Total Count</span>
              <span className="font-bold text-slate-800">{rows.filter((r) => Number(r.amount) > 0).length}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-lg">
              <span className="font-bold text-slate-800">Grand Total</span>
              <span className="font-bold text-orange-700">{formatINR(liveTotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
