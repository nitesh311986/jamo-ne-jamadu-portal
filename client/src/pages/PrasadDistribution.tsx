import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactElement,
} from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  HandHeart,
  Package,
  Receipt as ReceiptIcon,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import api from '../api/axios';
import { formatINR } from '../utils/currency';
import SevakSearchSelect from '../components/SevakSearchSelect';
import type { Sevak } from '../types/sevak';

interface DistributionReceipt {
  id: string;
  receiptNo: string;
  donorName: string | null;
  amount: number;
  prasadDistributed: boolean;
  distributedAt: string | null;
  boxesGenerated: number;
}

interface BookGroup {
  bookNumber: string;
  status: string;
  assignedAt: string;
  receipts: DistributionReceipt[];
}

interface TierBreakdown {
  slabTier: string;
  tierLabel: string;
  minAmount: number;
  maxAmount: number | null;
  totalReceipts: number;
  unservedReceipts: number;
  eligibleBoxes: number;
  distributedBoxes: number;
  remainingBoxes: number;
}

interface DistributionOverview {
  sevak: Sevak;
  books: { total: number; completed: number; partially: number; pending: number };
  receipts: { total: number; served: number; unserved: number };
  tiers: TierBreakdown[];
  grandTotal: {
    totalSevaAmount: number;
    eligibleBoxes: number;
    distributedBoxes: number;
    pendingBoxes: number;
  };
  receiptsByBook: BookGroup[];
}

export default function PrasadDistribution(): ReactElement {
  const [selectedSevak, setSelectedSevak] = useState<Sevak | null>(null);
  const [overview, setOverview] = useState<DistributionOverview | null>(null);
  const [tierInputs, setTierInputs] = useState<Record<string, number>>({});
  const [selectedReceipts, setSelectedReceipts] = useState<Set<string>>(new Set());
  const [expandedBooks, setExpandedBooks] = useState<Record<string, boolean>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!selectedSevak) {
      setOverview(null);
      setTierInputs({});
      setSelectedReceipts(new Set());
      setExpandedBooks({});
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    api
      .get<DistributionOverview>(`/api/v1/prasad/sevak/${selectedSevak.id}`)
      .then(({ data }) => {
        setOverview(data);
        const inputs: Record<string, number> = {};
        for (const tier of data.tiers) {
          inputs[tier.slabTier] = 0;
        }
        setTierInputs(inputs);

        const expanded: Record<string, boolean> = {};
        for (const group of data.receiptsByBook) {
          expanded[group.bookNumber] = true;
        }
        setExpandedBooks(expanded);
      })
      .catch(() => {
        setError('Failed to load distribution overview.');
      })
      .finally(() => setLoading(false));
  }, [selectedSevak]);

  const totalBoxesToIssue = useMemo(() => {
    return Object.values(tierInputs).reduce((sum, v) => sum + (Number.isNaN(v) ? 0 : v), 0);
  }, [tierInputs]);

  const allSelectedValid = useMemo(() => {
    if (!overview) return false;
    for (const tier of overview.tiers) {
      const val = tierInputs[tier.slabTier] ?? 0;
      if (val < 0 || val > tier.remainingBoxes) return false;
    }
    return selectedReceipts.size > 0 && totalBoxesToIssue > 0;
  }, [overview, tierInputs, selectedReceipts, totalBoxesToIssue]);

  const handleTierInput = (slabTier: string, value: string): void => {
    const parsed = value === '' ? 0 : parseInt(value, 10);
    setTierInputs((prev) => ({
      ...prev,
      [slabTier]: Number.isNaN(parsed) ? 0 : parsed,
    }));
    setError('');
  };

  const toggleReceipt = (id: string): void => {
    setSelectedReceipts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setError('');
  };

  const toggleAllInBook = (group: BookGroup, selected: boolean): void => {
    setSelectedReceipts((prev) => {
      const next = new Set(prev);
      const unserved = group.receipts.filter((r) => !r.prasadDistributed);
      for (const r of unserved) {
        if (selected) {
          next.add(r.id);
        } else {
          next.delete(r.id);
        }
      }
      return next;
    });
    setError('');
  };

  const toggleBookExpand = (bookNumber: string): void => {
    setExpandedBooks((prev) => ({ ...prev, [bookNumber]: !prev[bookNumber] }));
  };

  const handleDistribute = async (): Promise<void> => {
    if (!overview || !selectedSevak) return;

    const tierDistributions = Object.entries(tierInputs)
      .filter(([, count]) => count > 0)
      .map(([slabTier, distributeCount]) => ({ slabTier, distributeCount }));

    if (tierDistributions.length === 0 || selectedReceipts.size === 0) {
      setError('Select at least one receipt and one box to issue.');
      return;
    }

    setDistributing(true);
    setError('');
    setSuccess('');

    try {
      await api.post('/api/v1/prasad/distribute', {
        sevakId: selectedSevak.id,
        tierDistributions,
        receiptIdsToMark: [...selectedReceipts],
      });

      setSuccess('Prasad handed over successfully.');
      setSelectedReceipts(new Set());
      setTierInputs((prev) => {
        const reset: Record<string, number> = {};
        for (const key of Object.keys(prev)) {
          reset[key] = 0;
        }
        return reset;
      });
      setShowConfirm(false);

      const { data } = await api.get<DistributionOverview>(
        `/api/v1/prasad/sevak/${selectedSevak.id}`
      );
      setOverview(data);
    } catch (err) {
      const message =
        (err as { response?: { data?: { error?: string } } }).response?.data?.error ??
        'Failed to record distribution.';
      setError(message);
    } finally {
      setDistributing(false);
    }
  };

  const handleDownload = async (): Promise<void> => {
    try {
      const { data } = await api.get<Blob>('/api/v1/reports/master-summary/excel', {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'master-summary.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to download master summary.');
    }
  };

  return (
    <div className="min-h-screen space-y-5 pb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Prasad Distribution Counter</h1>
          <p className="text-sm text-slate-500">Select a sevak, verify eligibility, and hand over prasad boxes.</p>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700"
        >
          <Download size={16} />
          Master Summary (Excel)
        </button>
      </div>

      <SevakSearchSelect
        selected={selectedSevak}
        onSelect={setSelectedSevak}
        onClear={() => setSelectedSevak(null)}
      />

      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
          Loading distribution overview…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={18} />
          {error}
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          <Check size={18} />
          {success}
        </div>
      )}

      {overview && selectedSevak && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-orange-100 bg-orange-50 p-4">
              <p className="text-xs font-medium uppercase text-orange-700">Total Seva</p>
              <p className="mt-1 text-2xl font-bold text-orange-900">
                {formatINR(overview.grandTotal.totalSevaAmount)}
              </p>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-xs font-medium uppercase text-blue-700">Receipts</p>
              <p className="mt-1 text-2xl font-bold text-blue-900">
                {overview.receipts.served} <span className="text-lg font-normal">/ {overview.receipts.total}</span>
              </p>
              <span className="mt-1 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                {overview.receipts.unserved} Unserved
              </span>
            </div>
            <div className="rounded-xl border border-purple-100 bg-purple-50 p-4">
              <p className="text-xs font-medium uppercase text-purple-700">Books</p>
              <p className="mt-1 text-2xl font-bold text-purple-900">
                {overview.books.completed} <span className="text-lg font-normal">/ {overview.books.total}</span>
              </p>
              <span className="mt-1 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                {overview.books.pending} Pending
              </span>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-xs font-medium uppercase text-emerald-700">Boxes</p>
              <p className="mt-1 text-2xl font-bold text-emerald-900">
                {overview.grandTotal.distributedBoxes}{' '}
                <span className="text-lg font-normal">/ {overview.grandTotal.eligibleBoxes}</span>
              </p>
              <span className="mt-1 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                {overview.grandTotal.pendingBoxes} to Issue
              </span>
            </div>
          </div>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Slab-wise Box Allocation
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {overview.tiers.map((tier) => {
                const input = tierInputs[tier.slabTier] ?? 0;
                const isOver = input > tier.remainingBoxes;
                return (
                  <div
                    key={tier.slabTier}
                    className={`rounded-xl border bg-white p-4 shadow-sm transition ${
                      isOver ? 'border-red-300 ring-1 ring-red-200' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Package size={18} className="text-orange-600" />
                        <span className="font-semibold text-slate-800">{tier.tierLabel}</span>
                      </div>
                      <span className="text-xs text-slate-500">{tier.totalReceipts} receipts</span>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-xs text-slate-500">Eligible</p>
                        <p className="font-semibold text-slate-800">{tier.eligibleBoxes}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-xs text-slate-500">Given</p>
                        <p className="font-semibold text-slate-800">{tier.distributedBoxes}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-2">
                        <p className="text-xs text-slate-500">Remaining</p>
                        <p className="font-semibold text-slate-800">{tier.remainingBoxes}</p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <label htmlFor={`issue-${tier.slabTier}`} className="sr-only">
                        Issue boxes for {tier.tierLabel}
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          id={`issue-${tier.slabTier}`}
                          type="number"
                          min={0}
                          max={tier.remainingBoxes}
                          value={input}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            handleTierInput(tier.slabTier, e.target.value)
                          }
                          className={`w-full rounded-lg border px-3 py-2 text-sm outline-none transition ${
                            isOver
                              ? 'border-red-300 bg-red-50 text-red-700 focus:border-red-500'
                              : 'border-slate-300 focus:border-orange-500 focus:ring-1 focus:ring-orange-500'
                          }`}
                        />
                        <span className="whitespace-nowrap text-xs text-slate-500">boxes</span>
                      </div>
                      {isOver && (
                        <p className="mt-1 text-xs text-red-600">
                          Cannot exceed {tier.remainingBoxes} boxes
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
              Receipts & Books to Hand Over
            </h2>
            <div className="space-y-2">
              {overview.receiptsByBook.map((group) => {
                const unserved = group.receipts.filter((r) => !r.prasadDistributed);
                const allSelected = unserved.length > 0 && unserved.every((r) => selectedReceipts.has(r.id));
                const expanded = expandedBooks[group.bookNumber] ?? false;

                return (
                  <div
                    key={group.bookNumber}
                    className="rounded-xl border border-slate-200 bg-white shadow-sm"
                  >
                    <button
                      type="button"
                      onClick={() => toggleBookExpand(group.bookNumber)}
                      className="flex w-full items-center justify-between rounded-xl p-4 text-left hover:bg-slate-50"
                    >
                      <div className="flex items-center gap-3">
                        <BookOpen size={18} className="text-slate-500" />
                        <div>
                          <p className="font-semibold text-slate-800">Book {group.bookNumber}</p>
                          <p className="text-xs text-slate-500">
                            {group.receipts.length} receipts · {unserved.length} unserved · Status: {group.status}
                          </p>
                        </div>
                      </div>
                      {expanded ? <ChevronUp size={18} className="text-slate-500" /> : <ChevronDown size={18} className="text-slate-500" />}
                    </button>

                    {expanded && (
                      <div className="border-t border-slate-100 p-4">
                        {unserved.length > 0 && (
                          <label className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                toggleAllInBook(group, e.target.checked)
                              }
                              className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                            />
                            Select All Unserved
                          </label>
                        )}

                        <div className="space-y-2">
                          {group.receipts.map((r) => {
                            const isServed = r.prasadDistributed;
                            return (
                              <div
                                key={r.id}
                                className={`flex items-center justify-between rounded-lg border p-3 ${
                                  isServed
                                    ? 'border-emerald-100 bg-emerald-50'
                                    : 'border-slate-200 bg-white'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  {!isServed && (
                                    <input
                                      type="checkbox"
                                      checked={selectedReceipts.has(r.id)}
                                      onChange={() => toggleReceipt(r.id)}
                                      className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                                    />
                                  )}
                                  <ReceiptIcon size={16} className={isServed ? 'text-emerald-600' : 'text-slate-500'} />
                                  <div>
                                    <p className="text-sm font-medium text-slate-800">
                                      {r.receiptNo}
                                      {isServed && (
                                        <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                                          Served
                                        </span>
                                      )}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {r.donorName ?? 'Anonymous'} · {formatINR(r.amount)}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  {r.boxesGenerated > 0 && (
                                    <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                                      1 box
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] lg:pl-64">
            <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 sm:flex-row">
              <div className="text-sm text-slate-600">
                <span className="font-semibold text-slate-800">{totalBoxesToIssue}</span> boxes ·{' '}
                <span className="font-semibold text-slate-800">{selectedReceipts.size}</span> receipts selected
              </div>
              <button
                type="button"
                disabled={!allSelectedValid}
                onClick={() => setShowConfirm(true)}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              >
                <HandHeart size={18} />
                Confirm & Hand Over Prasad
              </button>
            </div>
          </div>

          {showConfirm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
                <h3 className="text-lg font-bold text-slate-800">Confirm Prasad Hand Over</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {overview.sevak.sevakCode} — {overview.sevak.fullName}
                </p>

                <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm">
                  <p>
                    <span className="font-semibold text-slate-700">Boxes in this batch:</span>{' '}
                    {totalBoxesToIssue}
                  </p>
                  <p className="mt-1">
                    <span className="font-semibold text-slate-700">Receipts to mark served:</span>{' '}
                    {selectedReceipts.size}
                  </p>
                  <p className="mt-1">
                    <span className="font-semibold text-slate-700">Remaining boxes after this:</span>{' '}
                    {overview.grandTotal.pendingBoxes - totalBoxesToIssue}
                  </p>
                </div>

                <div className="mt-4 max-h-48 overflow-y-auto rounded-lg border border-slate-200 p-3 text-sm">
                  <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Selected receipt numbers</p>
                  <div className="flex flex-wrap gap-2">
                    {overview.receiptsByBook
                      .flatMap((g) => g.receipts)
                      .filter((r) => selectedReceipts.has(r.id))
                      .map((r) => (
                        <span
                          key={r.id}
                          className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
                        >
                          {r.receiptNo}
                        </span>
                      ))}
                  </div>
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={distributing}
                    onClick={handleDistribute}
                    className="flex-1 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-50"
                  >
                    {distributing ? 'Recording…' : 'Confirm & Hand Over'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
