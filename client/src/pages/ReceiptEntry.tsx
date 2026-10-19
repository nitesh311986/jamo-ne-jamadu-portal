import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactElement,
} from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  IndianRupee,
  Save,
  Search,
} from 'lucide-react';
import api from '../api/axios';
import { formatINR } from '../utils/currency';
import type { Sevak, SevakSearchResponse } from '../types/sevak';
import type { BookAllocation } from '../types/book';
import type {
  Receipt,
  ReceiptSummaryResponse,
  BulkSyncResponse,
} from '../types/receipt';
import type { ApiError } from '../types/auth';
import type { AxiosError } from 'axios';

interface ReceiptDraftRow {
  tempId: string;
  id?: string;
  bookNumber: string;
  receiptNo: string;
  donorName: string;
  donorMobile: string;
  amount: string | number;
  isSaved?: boolean;
}

function normalizeMobile(value: string): string {
  return value.replace(/\D/g, '');
}

function makeTempId(bookNumber: string, i: number, id?: string): string {
  const no = String(i).padStart(2, '0');
  return id
    ? `${bookNumber}-${no}-${id}`
    : `${bookNumber}-${no}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function isBookCompleted(rows: ReceiptDraftRow[]): boolean {
  return rows.length === 10 && rows.every((r) => r.isSaved && Number(r.amount) > 0);
}

export default function ReceiptEntry(): ReactElement {
  const [sevakQuery, setSevakQuery] = useState<string>('');
  const [sevakResults, setSevakResults] = useState<Sevak[]>([]);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [selectedSevak, setSelectedSevak] = useState<Sevak | null>(null);
  const [books, setBooks] = useState<BookAllocation[]>([]);
  const [savedSummary, setSavedSummary] = useState<ReceiptSummaryResponse | null>(null);
  const [bookRows, setBookRows] = useState<Record<string, ReceiptDraftRow[]>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sahSevak, setSahSevak] = useState<
    Record<string, { name: string; mobile: string }>
  >({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

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

  const loadBooks = useCallback(async (sevakId: string): Promise<void> => {
    try {
      const { data } = await api.get<{
        books: BookAllocation[];
        total: number;
        page: number;
        limit: number;
      }>(`/api/v1/books/sevak/${sevakId}`, {
        params: { page: 1, limit: 50 },
      });
      setBooks(data.books);
    } catch {
      setError('Failed to load assigned books');
    }
  }, []);

  const loadSummary = useCallback(async (sevakId: string): Promise<void> => {
    try {
      const { data } = await api.get<ReceiptSummaryResponse>(
        `/api/v1/receipts/sevak/${sevakId}/summary`
      );
      setSavedSummary(data);
    } catch {
      setError('Failed to load receipt summary');
    }
  }, []);

  useEffect(() => {
    if (selectedSevak) {
      void loadBooks(selectedSevak.id);
      void loadSummary(selectedSevak.id);
    }
  }, [selectedSevak, loadBooks, loadSummary]);

  const selectSevak = async (sevak: Sevak): Promise<void> => {
    setSelectedSevak(sevak);
    setSevakQuery('');
    setSevakResults([]);
    setShowDropdown(false);
    setSavedSummary(null);
    setBookRows({});
    setExpanded({});
    setError('');
    setSuccess('');
  };

  const loadBookReceipts = useCallback(
    async (bookNumber: string): Promise<void> => {
      if (!selectedSevak) return;

      try {
        const { data } = await api.get<{ receipts: Receipt[] }>(
          `/api/v1/receipts/sevak/${selectedSevak.id}`,
          {
            params: { bookNumber, limit: 50 },
          }
        );

        const byNo = new Map(data.receipts.map((r) => [r.receiptNo, r]));
        const rows: ReceiptDraftRow[] = [];

        for (let i = 1; i <= 10; i += 1) {
          const no = String(i).padStart(2, '0');
          const existing = byNo.get(no);

          if (existing) {
            rows.push({
              tempId: makeTempId(bookNumber, i, existing.id),
              id: existing.id,
              bookNumber,
              receiptNo: existing.receiptNo,
              donorName: existing.donorName,
              donorMobile: existing.donorMobile ?? '',
              amount: String(existing.amount),
              isSaved: true,
            });
          } else {
            rows.push({
              tempId: makeTempId(bookNumber, i),
              bookNumber,
              receiptNo: no,
              donorName: '',
              donorMobile: '',
              amount: '',
              isSaved: false,
            });
          }
        }

        setBookRows((prev) => ({ ...prev, [bookNumber]: rows }));
        setExpanded((prev) => ({ ...prev, [bookNumber]: !isBookCompleted(rows) }));
      } catch {
        setError(`Failed to load receipts for Book ${bookNumber}`);
      }
    },
    [selectedSevak]
  );

  const handleBookSelect = (e: ChangeEvent<HTMLSelectElement>): void => {
    const bookNumber = e.target.value;
    if (!bookNumber || !selectedSevak) return;

    const currentBook = books.find((b) => b.bookNumber === bookNumber);
    if (currentBook) {
      setSahSevak((prev) => ({
        ...prev,
        [bookNumber]: {
          name: currentBook.sahSevakName ?? '',
          mobile: currentBook.sahSevakMobile ?? '',
        },
      }));
    }

    if (!bookRows[bookNumber]) {
      void loadBookReceipts(bookNumber);
    } else {
      setExpanded((prev) => ({ ...prev, [bookNumber]: true }));
    }
  };

  const updateRow = (
    bookNumber: string,
    index: number,
    field: keyof ReceiptDraftRow,
    value: string
  ): void => {
    setBookRows((prev) => {
      const rows = prev[bookNumber];
      if (!rows) return prev;

      const next = [...rows];
      const updated = { ...next[index], [field]: value, isSaved: false } as ReceiptDraftRow;
      next[index] = updated;

      return { ...prev, [bookNumber]: next };
    });
  };

  const updateSahSevak = (
    bookNumber: string,
    field: 'name' | 'mobile',
    value: string
  ): void => {
    setSahSevak((prev) => ({
      ...prev,
      [bookNumber]: { ...prev[bookNumber], [field]: value },
    }));
  };

  const duplicateIds = useMemo(() => {
    const seen = new Map<string, string[]>();
    const dupes = new Set<string>();

    for (const row of Object.values(bookRows).flat()) {
      const bn = row.bookNumber.trim();
      const rn = row.receiptNo.trim();
      if (!bn || !rn) continue;

      const key = `${bn}|${rn}`;
      const list = seen.get(key) ?? [];
      list.push(row.tempId);
      seen.set(key, list);
    }

    for (const list of seen.values()) {
      if (list.length > 1) {
        list.forEach((id) => dupes.add(id));
      }
    }

    return dupes;
  }, [bookRows]);

  const liveSummary = useMemo(() => {
    const groups: Record<string, { amount: number; count: number; subTotal: number }> = {};
    const activeBooks = new Set<string>();

    for (const [bookNumber, rows] of Object.entries(bookRows)) {
      for (const row of rows) {
        const amount = Number(row.amount);
        if (!amount || Number.isNaN(amount) || amount <= 0) continue;

        const key = amount.toFixed(2);
        if (!groups[key]) {
          groups[key] = { amount, count: 0, subTotal: 0 };
        }
        groups[key].count += 1;
        groups[key].subTotal += amount;
        activeBooks.add(bookNumber);
      }
    }

    const groupList = Object.values(groups).sort((a, b) => a.amount - b.amount);
    const grandTotal = groupList.reduce((sum, g) => sum + g.subTotal, 0);
    const totalCount = groupList.reduce((sum, g) => sum + g.count, 0);

    return {
      groups: groupList,
      grandTotal,
      totalCount,
      uniqueBooks: activeBooks.size,
    };
  }, [bookRows]);

  const validateBookRows = (
    bookNumber: string,
    rowsToSave: ReceiptDraftRow[]
  ): { valid: boolean; payload: Array<{
    id?: string;
    receiptNo: string;
    donorName: string;
    donorMobile: string | null;
    amount: number;
  }> } | null => {
    const seen = new Set<string>();

    for (const r of rowsToSave) {
      const no = r.receiptNo.trim();
      if (!no) {
        setError(`Receipt No is required in Book ${bookNumber}`);
        return null;
      }

      const key = `${bookNumber}|${no}`;
      if (seen.has(key)) {
        setError(`Duplicate receipt number ${no} in Book ${bookNumber}`);
        return null;
      }
      seen.add(key);

      if (r.amount !== '') {
        const amount = Number(r.amount);
        if (Number.isNaN(amount) || amount < 0) {
          setError(`Invalid amount for receipt ${no}`);
          return null;
        }
      }
    }

    const payload = rowsToSave.map((r) => ({
      id: r.id,
      receiptNo: r.receiptNo.trim(),
      donorName: r.donorName.trim(),
      donorMobile: r.donorMobile.trim() ? normalizeMobile(r.donorMobile) : null,
      amount: r.amount === '' ? 0 : Number(r.amount),
    }));

    return { valid: true, payload };
  };

  const handleSaveBook = async (bookNumber: string): Promise<void> => {
    if (!selectedSevak) {
      setError('Select a sevak first');
      return;
    }

    const rows = bookRows[bookNumber];
    if (!rows) return;

    const rowsToSave = rows.filter(
      (r) => (r.amount !== '' && Number(r.amount) > 0) || r.donorName.trim() !== ''
    );

    if (rowsToSave.length === 0) {
      setSuccess('No receipt amounts entered to save.');
      return;
    }

    const result = validateBookRows(bookNumber, rowsToSave);
    if (!result) return;

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const { data } = await api.post<BulkSyncResponse>('/api/v1/receipts/bulk-sync', {
        sevakId: selectedSevak.id,
        bookNumber,
        receipts: result.payload,
        sahSevakName: sahSevak[bookNumber]?.name,
        sahSevakMobile: sahSevak[bookNumber]?.mobile,
      });

      if (data.success) {
        setSuccess(`Saved ${rowsToSave.length} receipts for Book ${bookNumber}`);
        await loadBookReceipts(bookNumber);
      }
    } catch (err) {
      setError(
        (err as AxiosError<ApiError>).response?.data?.error ?? 'Failed to save changes'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveRow = async (bookNumber: string, index: number): Promise<void> => {
    if (!selectedSevak) {
      setError('Select a sevak first');
      return;
    }

    const rows = bookRows[bookNumber];
    if (!rows) return;

    const row = rows[index];
    const isRowToSave =
      (row.amount !== '' && Number(row.amount) > 0) || row.donorName.trim() !== '';

    if (!isRowToSave) {
      setSuccess('No receipt amount entered to save.');
      return;
    }

    const allNos = new Set<string>();
    for (const r of rows) {
      const no = r.receiptNo.trim();
      if (!no) continue;
      if (allNos.has(no)) {
        setError(`Duplicate receipt number ${no} in Book ${bookNumber}`);
        return;
      }
      allNos.add(no);
    }

    const result = validateBookRows(bookNumber, [row]);
    if (!result) return;

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const { data } = await api.post<BulkSyncResponse>('/api/v1/receipts/bulk-sync', {
        sevakId: selectedSevak.id,
        bookNumber,
        receipts: result.payload,
        sahSevakName: sahSevak[bookNumber]?.name,
        sahSevakMobile: sahSevak[bookNumber]?.mobile,
      });

      if (data.success) {
        setSuccess(`Saved receipt ${row.receiptNo.trim()} for Book ${bookNumber}`);
        await loadBookReceipts(bookNumber);
      }
    } catch (err) {
      setError(
        (err as AxiosError<ApiError>).response?.data?.error ?? 'Failed to save receipt'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const bookOptions = useMemo(() => books.map((b) => b.bookNumber), [books]);

  const inputClass =
    'w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500';
  const duplicateClass =
    'w-full rounded border border-red-400 bg-red-50 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-500';

  const renderBookCard = (bookNumber: string): ReactElement => {
    const rows = bookRows[bookNumber] ?? [];
    const completed = isBookCompleted(rows);
    const savedCount = rows.filter((r) => r.isSaved).length;
    const total = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const isExpanded = expanded[bookNumber] ?? !completed;

    return (
      <div
        key={bookNumber}
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <button
          type="button"
          onClick={() =>
            setExpanded((prev) => ({ ...prev, [bookNumber]: !isExpanded }))
          }
          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
        >
          <div className="flex flex-wrap items-center gap-2">
            <BookOpen size={18} className="text-orange-600" />
            <span className="font-semibold text-slate-800">Book {bookNumber}</span>
            <span className="text-xs text-slate-600">
              Sah-Sevak: {sahSevak[bookNumber]?.name || 'None'}
            </span>
            <span className="text-sm text-slate-500">
              {completed
                ? '10/10 Receipts Completed'
                : `${savedCount}/10 In Progress`}
            </span>
            <span className="text-sm font-semibold text-slate-700">
              {formatINR(total)}
            </span>
            {completed && (
              <span className="text-xs text-emerald-600">(Click to View / Edit)</span>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp size={18} className="text-slate-500" />
          ) : (
            <ChevronDown size={18} className="text-slate-500" />
          )}
        </button>

        {isExpanded && (
          <div className="p-4">
            <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Sah-Sevak Name (Optional) / સહ-સેવક નામ
                </label>
                <input
                  type="text"
                  value={sahSevak[bookNumber]?.name ?? ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateSahSevak(bookNumber, 'name', e.target.value)
                  }
                  className={inputClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Sah-Sevak Mobile (Optional) / સહ-સેવક મોબાઇલ
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  value={sahSevak[bookNumber]?.mobile ?? ''}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateSahSevak(bookNumber, 'mobile', normalizeMobile(e.target.value))
                  }
                  className={inputClass}
                />
              </div>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-3 py-2 font-medium">Book No</th>
                  <th className="px-3 py-2 font-medium">Receipt No</th>
                  <th className="px-3 py-2 font-medium">Donor Name</th>
                  <th className="px-3 py-2 font-medium">Donor Mobile</th>
                  <th className="px-3 py-2 font-medium">Amount</th>
                  <th className="px-3 py-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, index) => {
                  const isDup = duplicateIds.has(row.tempId);
                  return (
                    <tr key={row.tempId} className={row.isSaved ? 'bg-emerald-50' : ''}>
                      <td className="px-2 py-1.5 align-top">
                        <span className="font-semibold text-gray-700">
                          {row.bookNumber}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <input
                          type="text"
                          value={row.receiptNo}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            updateRow(bookNumber, index, 'receiptNo', e.target.value)
                          }
                          className={isDup ? duplicateClass : inputClass}
                        />
                        {isDup && (
                          <p className="mt-0.5 text-xs text-red-600">Duplicate receipt</p>
                        )}
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <input
                          type="text"
                          value={row.donorName}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            updateRow(bookNumber, index, 'donorName', e.target.value)
                          }
                          className={inputClass}
                        />
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <input
                          type="text"
                          value={row.donorMobile}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            updateRow(bookNumber, index, 'donorMobile', e.target.value)
                          }
                          className={inputClass}
                        />
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={row.amount}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            updateRow(bookNumber, index, 'amount', e.target.value)
                          }
                          className={inputClass}
                        />
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <div className="flex items-center gap-1.5">
                          {row.isSaved && (
                            <CheckCircle size={16} className="text-emerald-600" />
                          )}
                          <button
                            type="button"
                            onClick={() => void handleSaveRow(bookNumber, index)}
                            disabled={isSaving}
                            className="flex items-center gap-1 rounded bg-orange-600 px-2 py-1 text-xs font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Save size={14} />
                            Save
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-3">
              <button
                type="button"
                onClick={() => void handleSaveBook(bookNumber)}
                disabled={isSaving}
                className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save All Changes'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

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
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
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
                  <span className="font-semibold text-orange-700">
                    {sevak.sevakCode}
                  </span>
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
                  Assigned books:{' '}
                  {books.map((b) => `${b.bookNumber} (${b.status})`).join(', ') || 'None'}
                </p>
              </div>
            </div>
            {savedSummary && (
              <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-500">Grand Total</p>
                  <p className="text-lg font-bold text-slate-800">
                    {formatINR(savedSummary.grandTotal)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Receipts</p>
                  <p className="text-lg font-bold text-slate-800">
                    {savedSummary.totalCount}
                  </p>
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
          <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            {success}
          </div>
        )}

        {selectedSevak && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <label className="block text-sm font-medium text-slate-700">
              Open Book
            </label>
            <select
              value={''}
              onChange={handleBookSelect}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
            >
              <option value="">Select a book</option>
              {bookOptions.map((bn) => (
                <option key={bn} value={bn}>
                  {bn}
                </option>
              ))}
            </select>
          </div>
        )}

        {Object.keys(bookRows).map(renderBookCard)}
      </div>

      <div className="lg:sticky lg:top-24 lg:col-span-1 lg:self-start">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <IndianRupee size={18} className="text-orange-600" />
            <h2 className="font-bold text-slate-800">Live Calculation</h2>
          </div>

          {liveSummary.groups.length === 0 ? (
            <p className="text-sm text-slate-500">Enter amounts to see the breakdown.</p>
          ) : (
            <div className="space-y-2">
              {liveSummary.groups.map((group) => (
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
              <span className="font-bold text-slate-800">{liveSummary.totalCount}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">Unique Books</span>
              <span className="font-bold text-slate-800">{liveSummary.uniqueBooks}</span>
            </div>
            <div className="mt-1 flex items-center justify-between text-lg">
              <span className="font-bold text-slate-800">Grand Total</span>
              <span className="font-bold text-orange-700">
                {formatINR(liveSummary.grandTotal)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
