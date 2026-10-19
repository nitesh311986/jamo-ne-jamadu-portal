import {
  AlertCircle,
  Banknote,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Phone,
  UserCheck,
  X,
} from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';

interface Receipt {
  id: string;
  bookNumber: string;
  receiptNo: string;
  donorName: string;
  donorMobile: string;
  amount: number;
  entryDate: string;
}

interface SubmittedBook {
  bookNumber: string;
  receiptCount: number;
  totalAmount: number;
  sahSevakName: string | null;
  sahSevakMobile: string | null;
  receipts: Receipt[];
}

interface PartialBook {
  bookNumber: string;
  receiptCount: number;
  remainingCount: number;
  totalAmount: number;
  sahSevakName: string | null;
  sahSevakMobile: string | null;
  receipts: Receipt[];
}

interface AssignedOnlyBook {
  bookNumber: string;
  receiptCount: number;
  sahSevakName: string | null;
  sahSevakMobile: string | null;
}

interface DetailedSevak {
  fullName: string;
  sevakCode: string;
  mobile: string;
  altMobile: string | null;
  whatsapp: string | null;
  mandal: string;
  kshetra: string;
  totalAllocatedCount: number;
  submittedCount: number;
  partialCount: number;
  stillAssignedCount: number;
  totalSevaAmount: number;
  submittedBooks: SubmittedBook[];
  partialBooks: PartialBook[];
  assignedOnlyBooks: AssignedOnlyBook[];
}

interface SevakBookDetailsModalProps {
  sevak: DetailedSevak;
  onClose: () => void;
}

type TabKey = 'submitted' | 'partial' | 'assigned';

function formatCurrency(value: number): string {
  return `\u20b9${value.toLocaleString('en-IN')}`;
}

function getMissingReceipts(receipts: Receipt[]): string[] {
  const entered = new Set(receipts.map((r) => r.receiptNo));
  const missing: string[] = [];
  for (let i = 1; i <= 10; i += 1) {
    const n = String(i);
    if (!entered.has(n)) missing.push(n);
  }
  return missing;
}

function ReceiptRow({ receipt }: { receipt: Receipt }): ReactElement {
  return (
    <tr className="border-b border-slate-100 last:border-0">
      <td className="px-3 py-2 text-sm text-slate-700">{receipt.receiptNo}</td>
      <td className="px-3 py-2 text-sm text-slate-700">
        {receipt.donorName.trim() || '—'}
      </td>
      <td className="px-3 py-2 text-sm text-slate-700">
        {formatCurrency(receipt.amount)}
      </td>
      <td className="px-3 py-2 text-sm text-slate-500">
        {new Date(receipt.entryDate).toLocaleDateString('en-IN')}
      </td>
    </tr>
  );
}

function SubmittedBookCard({ book }: { book: SubmittedBook }): ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
            <BookOpen size={20} />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800">
              Book {book.bookNumber}
            </div>
            <div className="text-xs text-emerald-700">
              {book.receiptCount} / 10 receipts completed
            </div>
            {book.sahSevakName && (
              <div className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                Sah-Sevak:{' '}
                <span className="font-medium text-gray-800">{book.sahSevakName}</span>{' '}
                ({book.sahSevakMobile || 'No Mobile'})
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-slate-500">Total Amount</div>
            <div className="text-sm font-semibold text-slate-800">
              {formatCurrency(book.totalAmount)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 text-xs font-medium">Receipt No</th>
                <th className="px-3 py-2 text-xs font-medium">Donor Name</th>
                <th className="px-3 py-2 text-xs font-medium">Amount</th>
                <th className="px-3 py-2 text-xs font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {book.receipts.map((receipt) => (
                <ReceiptRow key={receipt.id} receipt={receipt} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PartialBookCard({ book }: { book: PartialBook }): ReactElement {
  const [expanded, setExpanded] = useState(false);
  const progress = (book.receiptCount / 10) * 100;
  const missing = getMissingReceipts(book.receipts);

  return (
    <div className="rounded-xl border border-amber-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Clock size={20} />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-800">
              Book {book.bookNumber}
            </div>
            <div className="text-xs text-amber-700">
              {book.receiptCount} / 10 receipts entered
            </div>
            {book.sahSevakName && (
              <div className="text-xs text-gray-600 mt-1 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                Sah-Sevak:{' '}
                <span className="font-medium text-gray-800">{book.sahSevakName}</span>{' '}
                ({book.sahSevakMobile || 'No Mobile'})
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-slate-500">Subtotal</div>
            <div className="text-sm font-semibold text-slate-800">
              {formatCurrency(book.totalAmount)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      <div className="mt-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-2 rounded-full bg-amber-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {expanded && (
        <div className="mt-4 space-y-3">
          <div className="overflow-x-auto rounded-lg border border-slate-100">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-xs font-medium">Receipt No</th>
                  <th className="px-3 py-2 text-xs font-medium">Donor Name</th>
                  <th className="px-3 py-2 text-xs font-medium">Amount</th>
                  <th className="px-3 py-2 text-xs font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {book.receipts.map((receipt) => (
                  <ReceiptRow key={receipt.id} receipt={receipt} />
                ))}
              </tbody>
            </table>
          </div>

          {missing.length > 0 && (
            <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
              <span className="font-medium">Pending receipts:</span>{' '}
              {missing.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  icon,
  colorClass,
}: {
  label: string;
  value: string | number;
  icon: ReactElement;
  colorClass: string;
}): ReactElement {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center gap-2">
        <span className={`${colorClass}`}>{icon}</span>
        <span className="text-xs font-medium text-slate-500">{label}</span>
      </div>
      <div className="text-xl font-bold text-slate-800">{value}</div>
    </div>
  );
}

export default function SevakBookDetailsModal({
  sevak,
  onClose,
}: SevakBookDetailsModalProps): ReactElement {
  const [activeTab, setActiveTab] = useState<TabKey>('submitted');

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const tabs: { key: TabKey; label: string; count: number; color: string }[] = [
    { key: 'submitted', label: 'Submitted', count: sevak.submittedCount, color: 'emerald' },
    { key: 'partial', label: 'Partial', count: sevak.partialCount, color: 'amber' },
    { key: 'assigned', label: 'Still Assigned', count: sevak.stillAssignedCount, color: 'slate' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center">
      <div className="my-8 w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800">{sevak.fullName}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <span className="rounded-md bg-amber-50 px-2 py-0.5 font-mono font-semibold text-amber-600">
                {sevak.sevakCode}
              </span>
              <span className="flex items-center gap-1">
                <Phone size={14} />
                {sevak.mobile}
              </span>
              {sevak.whatsapp && (
                <span className="text-slate-500">(WA: {sevak.whatsapp})</span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <MapPin size={14} />
              {sevak.mandal} &middot; {sevak.kshetra}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <SummaryCard
            label="Total Books"
            value={sevak.totalAllocatedCount}
            icon={<BookOpen size={18} />}
            colorClass="text-blue-600"
          />
          <SummaryCard
            label="Fully Submitted"
            value={sevak.submittedCount}
            icon={<CheckCircle2 size={18} />}
            colorClass="text-emerald-600"
          />
          <SummaryCard
            label="Partially Submitted"
            value={sevak.partialCount}
            icon={<Clock size={18} />}
            colorClass="text-amber-600"
          />
          <SummaryCard
            label="Still Assigned"
            value={sevak.stillAssignedCount}
            icon={<AlertCircle size={18} />}
            colorClass="text-slate-600"
          />
          <SummaryCard
            label="Total Seva Amount"
            value={formatCurrency(sevak.totalSevaAmount)}
            icon={<Banknote size={18} />}
            colorClass="text-orange-600"
          />
        </div>

        <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                activeTab === tab.key
                  ? `bg-${tab.color}-50 text-${tab.color}-700`
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  activeTab === tab.key
                    ? `bg-${tab.color}-100 text-${tab.color}-700`
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {activeTab === 'submitted' && (
            <>
              {sevak.submittedBooks.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  No fully submitted books.
                </div>
              ) : (
                sevak.submittedBooks.map((book) => (
                  <SubmittedBookCard key={book.bookNumber} book={book} />
                ))
              )}
            </>
          )}

          {activeTab === 'partial' && (
            <>
              {sevak.partialBooks.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  No partially submitted books.
                </div>
              ) : (
                sevak.partialBooks.map((book) => (
                  <PartialBookCard key={book.bookNumber} book={book} />
                ))
              )}
            </>
          )}

          {activeTab === 'assigned' && (
            <>
              {sevak.assignedOnlyBooks.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  No still assigned books.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {sevak.assignedOnlyBooks.map((book) => (
                    <div
                      key={book.bookNumber}
                      className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <BookOpen size={16} className="text-slate-400" />
                        Book {book.bookNumber}
                      </div>
                      {book.sahSevakName && (
                        <div className="text-xs text-gray-600 flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5 text-amber-600" />
                          Sah-Sevak:{' '}
                          <span className="font-medium text-gray-800">{book.sahSevakName}</span>{' '}
                          ({book.sahSevakMobile || 'No Mobile'})
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
