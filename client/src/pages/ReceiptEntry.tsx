import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement,
} from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  IndianRupee,
  Plus,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import api from '../api/axios';
import PaginationControls from '../components/common/PaginationControls';
import { formatINR } from '../utils/currency';
import type { Sevak, SevakSearchResponse } from '../types/sevak';
import type { BookAllocation } from '../types/book';
import type {
  Receipt,
  ReceiptInput,
  ReceiptUpdateItem,
  NewReceiptItem,
  BulkSyncResponse,
  ReceiptSummaryResponse,
} from '../types/receipt';
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

function normalizeMobile(value: string): string {
  return value.replace(/\D/g, '');
}

function inputFromReceipt(receipt: Receipt): ReceiptInput {
  return {
    bookNumber: receipt.bookNumber,
    receiptNo: receipt.receiptNo,
    donorName: receipt.donorName,
    donorMobile: receipt.donorMobile ?? '',
    amount: String(receipt.amount),
  };
}

export default function ReceiptEntry(): ReactElement {
  const [sevakQuery, setSevakQuery] = useState<string>('');
  const [sevakResults, setSevakResults] = useState<Sevak[]>([]);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [selectedSevak, setSelectedSevak] = useState<Sevak | null>(null);
  const [books, setBooks] = useState<BookAllocation[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [receiptTotal, setReceiptTotal] = useState<number>(0);
  const [receiptPage, setReceiptPage] = useState<number>(1);
  const [receiptPageSize, setReceiptPageSize] = useState<number>(10);
  const [savedSummary, setSavedSummary] = useState<ReceiptSummaryResponse | null>(null);
  const [edits, setEdits] = useState<Record<string, ReceiptInput>>({});
  const [drafts, setDrafts] = useState<ReceiptInput[]>([{ ...initialRow }]);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});
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
    const firstInput = lastRowRef.current?.querySelector('input, select') as
      | HTMLInputElement
      | HTMLSelectElement
      | null;
    firstInput?.focus();
  }, [drafts.length]);

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

  const loadReceipts = useCallback(async (sevakId: string): Promise<void> => {
    try {
      const { data } = await api.get<{
        sevak: { id: string; sevakCode: string; fullName: string; mandal: string };
        receipts: Receipt[];
        total: number;
        page: number;
        limit: number;
        summary: ReceiptSummaryResponse;
      }>(`/api/v1/receipts/sevak/${sevakId}`, {
        params: { page: receiptPage, limit: receiptPageSize },
      });
      setReceipts(data.receipts);
      setReceiptTotal(data.total);
      setReceiptPage(data.page);
      setSavedSummary(data.summary);
    } catch {
      setError('Failed to load receipts');
    }
  }, [receiptPage, receiptPageSize]);

  useEffect(() => {
    if (selectedSevak) {
      void loadBooks(selectedSevak.id);
      void loadReceipts(selectedSevak.id);
    }
  }, [selectedSevak, loadBooks, loadReceipts]);

  const selectSevak = async (sevak: Sevak): Promise<void> => {
    setSelectedSevak(sevak);
    setSevakQuery('');
    setSevakResults([]);
    setShowDropdown(false);
    setReceipts([]);
    setReceiptTotal(0);
    setReceiptPage(1);
    setSavedSummary(null);
    setEdits({});
    setDrafts([{ ...initialRow }]);
    setError('');
    setSuccess('');
  };

  const getExistingDisplay = (receipt: Receipt): ReceiptInput => {
    return edits[receipt.id] ?? inputFromReceipt(receipt);
  };

  const getExistingChanges = (receipt: Receipt): Partial<ReceiptUpdateItem> => {
    const display = getExistingDisplay(receipt);
    const changes: Partial<ReceiptUpdateItem> = { receiptId: receipt.id };

    if (display.receiptNo.trim() !== receipt.receiptNo) {
      changes.receiptNo = display.receiptNo.trim();
    }
    if (display.donorName.trim() !== receipt.donorName) {
      changes.donorName = display.donorName.trim();
    }
    const cleanMobile = display.donorMobile.trim()
      ? normalizeMobile(display.donorMobile)
      : null;
    if (cleanMobile !== (receipt.donorMobile ?? null)) {
      changes.donorMobile = cleanMobile;
    }
    const amount = Number(display.amount);
    if (!Number.isNaN(amount) && amount !== receipt.amount) {
      changes.amount = amount;
    }

    return changes;
  };

  const isExistingModified = (receipt: Receipt): boolean => {
    const c = getExistingChanges(receipt);
    return Object.keys(c).length > 1;
  };

  const isFieldModified = (receipt: Receipt, field: keyof ReceiptInput): boolean => {
    const display = getExistingDisplay(receipt);
    const original = inputFromReceipt(receipt);
    return display[field] !== original[field];
  };

  const allKeyedRows = useMemo(() => {
    const existing = receipts.map((r) => ({
      id: r.id,
      bookNumber: getExistingDisplay(r).bookNumber.trim(),
      receiptNo: getExistingDisplay(r).receiptNo.trim(),
    }));
    const draft = drafts.map((d, i) => ({
      id: `draft-${i}`,
      bookNumber: d.bookNumber.trim(),
      receiptNo: d.receiptNo.trim(),
    }));
    return [...existing, ...draft];
  }, [receipts, edits, drafts]);

  const duplicateIds = useMemo(() => {
    const seen = new Map<string, string[]>();
    const dupes = new Set<string>();
    for (const row of allKeyedRows) {
      if (!row.bookNumber || !row.receiptNo) continue;
      const key = `${row.bookNumber}|${row.receiptNo}`;
      const list = seen.get(key) ?? [];
      list.push(row.id);
      seen.set(key, list);
    }
    for (const list of seen.values()) {
      if (list.length > 1) {
        list.forEach((id) => dupes.add(id));
      }
    }
    return dupes;
  }, [allKeyedRows]);

  const liveSummary = useMemo(() => {
    const groups: Record<string, { amount: number; count: number; subTotal: number }> = {};

    if (savedSummary) {
      for (const group of savedSummary.groups) {
        const key = group.amount.toFixed(2);
        groups[key] = { ...group };
      }
    }

    const draftBooks = new Set<string>();
    for (const row of drafts) {
      const amount = Number(row.amount);
      if (!amount || Number.isNaN(amount) || amount <= 0) continue;
      const key = amount.toFixed(2);
      if (!groups[key]) {
        groups[key] = { amount, count: 0, subTotal: 0 };
      }
      groups[key].count += 1;
      groups[key].subTotal += amount;
      if (row.bookNumber.trim()) {
        draftBooks.add(row.bookNumber.trim());
      }
    }

    const groupList = Object.values(groups).sort((a, b) => a.amount - b.amount);
    const grandTotal = groupList.reduce((sum, g) => sum + g.subTotal, 0);
    const totalCount = groupList.reduce((sum, g) => sum + g.count, 0);

    return {
      groups: groupList,
      grandTotal,
      totalCount,
      uniqueBooks: (savedSummary?.uniqueBooks ?? 0) + draftBooks.size,
    };
  }, [savedSummary, drafts]);

  const updateExisting = (
    receipt: Receipt,
    field: keyof ReceiptInput,
    value: string
  ): void => {
    setEdits((prev) => {
      const current = prev[receipt.id] ?? inputFromReceipt(receipt);
      return { ...prev, [receipt.id]: { ...current, [field]: value } };
    });
  };

  const updateDraft = (
    index: number,
    field: keyof ReceiptInput,
    value: string
  ): void => {
    setDrafts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addDraft = (): void => {
    setDrafts((prev) => [...prev, { ...initialRow }]);
  };

  const removeDraft = (index: number): void => {
    setDrafts((prev) => {
      if (prev.length <= 1) return prev;
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const handleKeyDown = (
    e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
    rowId: string,
    field: keyof ReceiptInput
  ): void => {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    const fieldIndex = fieldOrder.indexOf(field);
    if (fieldIndex < fieldOrder.length - 1) {
      const nextField = fieldOrder[fieldIndex + 1];
      inputRefs.current[`${rowId}-${nextField}`]?.focus();
    } else {
      addDraft();
    }
  };

  const validateDisplay = (row: ReceiptInput, label: string): string => {
    if (!row.bookNumber.trim()) return `${label}: Book No is required`;
    if (!row.receiptNo.trim()) return `${label}: Receipt No is required`;
    const amount = Number(row.amount);
    if (Number.isNaN(amount) || amount <= 0) return `${label}: Invalid amount`;
    return '';
  };

  const saveExisting = async (receipt: Receipt): Promise<void> => {
    const display = getExistingDisplay(receipt);
    const validation = validateDisplay(display, `Existing row ${receipt.receiptNo}`);
    if (validation) {
      setError(validation);
      return;
    }

    const changes = getExistingChanges(receipt);
    if (Object.keys(changes).length <= 1) {
      setEdits((prev) => {
        const next = { ...prev };
        delete next[receipt.id];
        return next;
      });
      return;
    }

    const payload: ReceiptUpdateItem = {
      receiptId: receipt.id,
      ...(changes.receiptNo !== undefined && { receiptNo: changes.receiptNo }),
      ...(changes.donorName !== undefined && { donorName: changes.donorName }),
      ...(changes.donorMobile !== undefined && { donorMobile: changes.donorMobile }),
      ...(changes.amount !== undefined && { amount: changes.amount }),
    };

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      await api.put(`/api/v1/receipts/${receipt.id}`, payload);
      setSuccess('Receipt updated');
      setEdits((prev) => {
        const next = { ...prev };
        delete next[receipt.id];
        return next;
      });
      if (selectedSevak) {
        await loadReceipts(selectedSevak.id);
      }
    } catch (err) {
      setError(
        (err as AxiosError<ApiError>).response?.data?.error ?? 'Failed to update receipt'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deleteExisting = async (receipt: Receipt): Promise<void> => {
    if (!window.confirm('Delete this receipt?')) return;

    try {
      await api.delete(`/api/v1/receipts/${receipt.id}`);
      setSuccess('Receipt deleted');
      if (selectedSevak) {
        await loadReceipts(selectedSevak.id);
      }
    } catch (err) {
      setError(
        (err as AxiosError<ApiError>).response?.data?.error ?? 'Failed to delete receipt'
      );
    }
  };

  const handleSaveAll = async (): Promise<void> => {
    if (!selectedSevak) {
      setError('Select a sevak first');
      return;
    }

    const updates: ReceiptUpdateItem[] = [];
    for (const receipt of receipts) {
      const changes = getExistingChanges(receipt);
      if (Object.keys(changes).length <= 1) continue;

      const display = getExistingDisplay(receipt);
      const validation = validateDisplay(display, 'Modified row');
      if (validation) {
        setError(validation);
        return;
      }

      updates.push({
        receiptId: receipt.id,
        ...(changes.receiptNo !== undefined && { receiptNo: changes.receiptNo }),
        ...(changes.donorName !== undefined && { donorName: changes.donorName }),
        ...(changes.donorMobile !== undefined && { donorMobile: changes.donorMobile }),
        ...(changes.amount !== undefined && { amount: changes.amount }),
      });
    }

    const additions: NewReceiptItem[] = [];
    for (let i = 0; i < drafts.length; i += 1) {
      const draft = drafts[i];
      const isEmpty =
        !draft.bookNumber.trim() &&
        !draft.receiptNo.trim() &&
        !draft.donorName.trim() &&
        !draft.amount.trim();
      if (isEmpty) continue;

      const validation = validateDisplay(draft, `New row ${i + 1}`);
      if (validation) {
        setError(validation);
        return;
      }

      const amount = Number(draft.amount);
      const donorMobile = draft.donorMobile.trim()
        ? normalizeMobile(draft.donorMobile)
        : null;

      additions.push({
        bookNumber: draft.bookNumber.trim(),
        receiptNo: draft.receiptNo.trim(),
        donorName: draft.donorName.trim(),
        donorMobile,
        amount,
        entryDate: new Date().toISOString(),
      });
    }

    if (updates.length === 0 && additions.length === 0) {
      setError('No changes to save');
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const { data } = await api.post<BulkSyncResponse>('/api/v1/receipts/bulk-sync', {
        sevakId: selectedSevak.id,
        updates,
        additions,
      });

      setReceiptPage(1);
      setEdits({});
      setDrafts([{ ...initialRow }]);
      setSuccess(
        `Saved ${data.summary.totalCount} receipt${
          data.summary.totalCount === 1 ? '' : 's'
        } across ${data.summary.uniqueBooks ?? 0} book(s)`
      );
    } catch (err) {
      setError(
        (err as AxiosError<ApiError>).response?.data?.error ?? 'Failed to save changes'
      );
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass =
    'w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500';
  const modifiedClass =
    'w-full rounded border border-orange-400 bg-orange-50 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500';
  const duplicateClass =
    'w-full rounded border border-red-400 bg-red-50 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-500';

  const bookOptions = useMemo(() => {
    const base = new Set(books.map((b) => b.bookNumber));
    receipts.forEach((r) => base.add(r.bookNumber));
    return Array.from(base);
  }, [books, receipts]);

  const renderBookSelect = (
    value: string,
    onChange: (value: string) => void,
    onKeyDown: (e: KeyboardEvent<HTMLSelectElement>) => void,
    isDuplicate: boolean,
    rowId: string
  ): ReactElement => (
    <select
      value={value}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
      onKeyDown={(e: KeyboardEvent<HTMLSelectElement>) => onKeyDown(e)}
      ref={(el) => {
        inputRefs.current[`${rowId}-bookNumber`] = el;
      }}
      className={isDuplicate ? duplicateClass : inputClass}
    >
      <option value="">Select book</option>
      {bookOptions.map((bn) => (
        <option key={bn} value={bn}>
          {bn}
        </option>
      ))}
    </select>
  );

  const renderInput = (
    value: string,
    type: 'text' | 'number',
    onChange: (value: string) => void,
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void,
    isDuplicate: boolean,
    isModified: boolean,
    rowId: string,
    field: keyof ReceiptInput
  ): ReactElement => (
    <input
      type={type}
      min="0"
      step="1"
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => onKeyDown(e)}
      ref={(el) => {
        inputRefs.current[`${rowId}-${field}`] = el;
      }}
      className={
        isDuplicate ? duplicateClass : isModified ? modifiedClass : inputClass
      }
    />
  );

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
                  Assigned books:{' '}
                  {books.map((b) => `${b.bookNumber} (${b.status})`).join(', ') || 'None'}
                </p>
              </div>
            </div>
            {liveSummary && (
              <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-500">Grand Total</p>
                  <p className="text-lg font-bold text-slate-800">{formatINR(liveSummary.grandTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Receipts</p>
                  <p className="text-lg font-bold text-slate-800">{liveSummary.totalCount}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Books</p>
                  <p className="text-lg font-bold text-slate-800">{liveSummary.uniqueBooks}</p>
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
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {receipts.map((receipt) => {
                const display = getExistingDisplay(receipt);
                const isDup = duplicateIds.has(receipt.id);
                const isModified = isExistingModified(receipt);
                return (
                  <tr
                    key={receipt.id}
                    className={isModified ? 'bg-orange-50' : ''}
                  >
                    <td className="px-2 py-1.5 align-top">
                      {renderBookSelect(
                        display.bookNumber,
                        (v) => updateExisting(receipt, 'bookNumber', v),
                        (e) => handleKeyDown(e, receipt.id, 'bookNumber'),
                        isDup,
                        receipt.id
                      )}
                      {isDup && (
                        <p className="mt-0.5 text-xs text-red-600">Duplicate receipt</p>
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      {renderInput(
                        display.receiptNo,
                        'text',
                        (v) => updateExisting(receipt, 'receiptNo', v),
                        (e) => handleKeyDown(e, receipt.id, 'receiptNo'),
                        isDup,
                        isFieldModified(receipt, 'receiptNo'),
                        receipt.id,
                        'receiptNo'
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      {renderInput(
                        display.donorName,
                        'text',
                        (v) => updateExisting(receipt, 'donorName', v),
                        (e) => handleKeyDown(e, receipt.id, 'donorName'),
                        false,
                        isFieldModified(receipt, 'donorName'),
                        receipt.id,
                        'donorName'
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      {renderInput(
                        display.donorMobile,
                        'text',
                        (v) => updateExisting(receipt, 'donorMobile', v),
                        (e) => handleKeyDown(e, receipt.id, 'donorMobile'),
                        false,
                        isFieldModified(receipt, 'donorMobile'),
                        receipt.id,
                        'donorMobile'
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      {renderInput(
                        display.amount,
                        'number',
                        (v) => updateExisting(receipt, 'amount', v),
                        (e) => handleKeyDown(e, receipt.id, 'amount'),
                        false,
                        isFieldModified(receipt, 'amount'),
                        receipt.id,
                        'amount'
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => void saveExisting(receipt)}
                          disabled={isSaving || (!isModified && !isDup)}
                          className="flex items-center gap-1 rounded bg-orange-600 px-2 py-1 text-xs font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Save size={14} />
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteExisting(receipt)}
                          className="rounded bg-red-50 p-1.5 text-red-600 hover:bg-red-100"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {drafts.map((draft, index) => {
                const rowId = `draft-${index}`;
                const isDup = duplicateIds.has(rowId);
                const isLast = index === drafts.length - 1;
                return (
                  <tr
                    key={rowId}
                    ref={isLast ? lastRowRef : undefined}
                    className="bg-slate-50"
                  >
                    <td className="px-2 py-1.5 align-top">
                      {renderBookSelect(
                        draft.bookNumber,
                        (v) => updateDraft(index, 'bookNumber', v),
                        (e) => handleKeyDown(e, rowId, 'bookNumber'),
                        isDup,
                        rowId
                      )}
                      {isDup && (
                        <p className="mt-0.5 text-xs text-red-600">Duplicate receipt</p>
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      {renderInput(
                        draft.receiptNo,
                        'text',
                        (v) => updateDraft(index, 'receiptNo', v),
                        (e) => handleKeyDown(e, rowId, 'receiptNo'),
                        isDup,
                        false,
                        rowId,
                        'receiptNo'
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      {renderInput(
                        draft.donorName,
                        'text',
                        (v) => updateDraft(index, 'donorName', v),
                        (e) => handleKeyDown(e, rowId, 'donorName'),
                        false,
                        false,
                        rowId,
                        'donorName'
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      {renderInput(
                        draft.donorMobile,
                        'text',
                        (v) => updateDraft(index, 'donorMobile', v),
                        (e) => handleKeyDown(e, rowId, 'donorMobile'),
                        false,
                        false,
                        rowId,
                        'donorMobile'
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      {renderInput(
                        draft.amount,
                        'number',
                        (v) => updateDraft(index, 'amount', v),
                        (e) => handleKeyDown(e, rowId, 'amount'),
                        false,
                        false,
                        rowId,
                        'amount'
                      )}
                    </td>
                    <td className="px-2 py-1.5 align-top">
                      <button
                        type="button"
                        onClick={() => removeDraft(index)}
                        className="rounded bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"
                        title="Remove row"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {receiptTotal > 0 && (
          <PaginationControls
            currentPage={receiptPage}
            totalPages={Math.max(1, Math.ceil(receiptTotal / receiptPageSize))}
            totalCount={receiptTotal}
            pageSize={receiptPageSize}
            onPageChange={setReceiptPage}
            onPageSizeChange={(newSize) => {
              setReceiptPageSize(newSize);
              setReceiptPage(1);
            }}
            isLoading={isSaving}
          />
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addDraft}
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
          >
            <Plus size={16} />
            Add Row
          </button>
          <button
            type="button"
            onClick={() => void handleSaveAll()}
            disabled={isSaving || !selectedSevak}
            className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={16} />
            {isSaving ? 'Saving...' : 'Save All Changes'}
          </button>
        </div>
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
              <span className="font-bold text-orange-700">{formatINR(liveSummary.grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
