import { useEffect, useState, type ChangeEvent, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileDown, Loader2, Receipt as ReceiptIcon, Search } from 'lucide-react';
import api from '../api/axios';
import { formatINR } from '../utils/currency';
import type { Receipt, ReceiptSearchResponse } from '../types/receipt';
import type { ApiError } from '../types/auth';
import type { AxiosError } from 'axios';

const PAGE_SIZE = 20;

export default function ReceiptSearch(): ReactElement {
  const [bookNumber, setBookNumber] = useState<string>('');
  const [receiptNo, setReceiptNo] = useState<string>('');
  const [donorName, setDonorName] = useState<string>('');
  const [donorMobile, setDonorMobile] = useState<string>('');

  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const [debouncedBook, setDebouncedBook] = useState<string>('');
  const [debouncedReceipt, setDebouncedReceipt] = useState<string>('');
  const [debouncedName, setDebouncedName] = useState<string>('');
  const [debouncedMobile, setDebouncedMobile] = useState<string>('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedBook(bookNumber.trim());
      setDebouncedReceipt(receiptNo.trim());
      setDebouncedName(donorName.trim());
      setDebouncedMobile(donorMobile.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [bookNumber, receiptNo, donorName, donorMobile]);

  useEffect(() => {
    async function load(): Promise<void> {
      setIsLoading(true);
      setError('');
      try {
        const params: Record<string, string | number> = { page, limit: PAGE_SIZE };
        if (debouncedBook) params.bookNumber = debouncedBook;
        if (debouncedReceipt) params.receiptNo = debouncedReceipt;
        if (debouncedName) params.donorName = debouncedName;
        if (debouncedMobile) params.donorMobile = debouncedMobile;

        const { data } = await api.get<ReceiptSearchResponse>('/api/v1/receipts/search', {
          params,
        });
        setReceipts(data.receipts);
        setTotal(data.total);
      } catch (err) {
        setError(
          (err as AxiosError<ApiError>).response?.data?.error ?? 'Failed to load receipts'
        );
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [debouncedBook, debouncedReceipt, debouncedName, debouncedMobile, page]);

  const handleDownload = async (): Promise<void> => {
    setIsExporting(true);
    try {
      const response = await api.get('/api/v1/receipts/export/excel', {
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
      a.download = 'receipts.xlsx';
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

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const canGoPrevious = page > 1;
  const canGoNext = page < totalPages;

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500';

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
            Receipt Search
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
            to="/receipts/entry"
            className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
          >
            <ReceiptIcon size={16} />
            <span className="hidden sm:inline">New Entry</span>
          </Link>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={bookNumber}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setBookNumber(e.target.value)}
            placeholder="Book No"
            className={`${inputClass} pl-9`}
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={receiptNo}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setReceiptNo(e.target.value)}
            placeholder="Receipt No"
            className={`${inputClass} pl-9`}
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={donorName}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDonorName(e.target.value)}
            placeholder="Donor Name"
            className={`${inputClass} pl-9`}
          />
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={donorMobile}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setDonorMobile(e.target.value)}
            placeholder="Donor Mobile"
            className={`${inputClass} pl-9`}
          />
        </div>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {isLoading ? (
        <div className="py-12 text-center text-slate-500">Loading receipts...</div>
      ) : receipts.length === 0 ? (
        <div className="py-12 text-center text-slate-500">No receipts found.</div>
      ) : (
        <>
          <div className="mb-2 text-sm text-slate-500">
            Showing {receipts.length} of {total} receipt{total === 1 ? '' : 's'}
          </div>

          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Book No</th>
                  <th className="px-4 py-3 font-medium">Receipt No</th>
                  <th className="px-4 py-3 font-medium">Donor Name</th>
                  <th className="px-4 py-3 font-medium">Mobile</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Sevak Code</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {receipts.map((receipt) => (
                  <tr key={receipt.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{receipt.bookNumber}</td>
                    <td className="px-4 py-3">{receipt.receiptNo}</td>
                    <td className="px-4 py-3">{receipt.donorName}</td>
                    <td className="px-4 py-3">{receipt.donorMobile ?? '-'}</td>
                    <td className="px-4 py-3 font-semibold">{formatINR(receipt.amount)}</td>
                    <td className="px-4 py-3 font-semibold text-orange-700">
                      {receipt.sevak?.sevakCode ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {receipts.map((receipt) => (
              <div
                key={receipt.id}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-orange-700 font-semibold">{receipt.sevak?.sevakCode ?? '-'}</span>
                  <span className="font-bold">{formatINR(receipt.amount)}</span>
                </div>
                <div className="text-slate-800">{receipt.donorName}</div>
                <div className="text-sm text-slate-500">
                  Book {receipt.bookNumber} / Receipt {receipt.receiptNo}
                </div>
                <div className="text-sm text-slate-500">{receipt.donorMobile ?? '-'}</div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={!canGoPrevious}
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-slate-500">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={!canGoNext}
                className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
