import { useEffect, useState, type FormEvent, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileDown, Loader2, Plus, Search } from 'lucide-react';
import api from '../api/axios';
import PaginationControls from '../components/common/PaginationControls';
import type { Sevak, SevakSearchResponse } from '../types/sevak';
import type { ApiError } from '../types/auth';
import type { AxiosError } from 'axios';

export default function SevakList(): ReactElement {
  const [query, setQuery] = useState<string>('');
  const [debouncedQuery, setDebouncedQuery] = useState<string>('');
  const [sevaks, setSevaks] = useState<Sevak[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);

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
        const response = await api.get<SevakSearchResponse>('/api/v1/sevaks/search', {
          params: { q: debouncedQuery, page, limit: pageSize },
        });
        setSevaks(response.data.sevaks);
        setTotal(response.data.total);
      } catch (err) {
        setError(
          (err as AxiosError<ApiError>).response?.data?.error ?? 'Failed to load sevaks'
        );
      } finally {
        setIsLoading(false);
      }
    }
    void load();
  }, [debouncedQuery, page, pageSize]);

  const handleSearchSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();
    setDebouncedQuery(query.trim());
    setPage(1);
  };

  const handleDownload = async (): Promise<void> => {
    setIsExporting(true);
    try {
      const response = await api.get('/api/v1/sevaks/export/excel', {
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
      a.download = 'sevaks.xlsx';
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

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
            Sevak Directory
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
            to="/sevaks/register"
            className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700"
          >
            <Plus size={16} />
            <span className="hidden sm:inline">Register</span>
          </Link>
        </div>
      </div>

      <main className="space-y-4">
        <form onSubmit={handleSearchSubmit} className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="શોધો / Search by name, code, or mobile"
              className={`${inputClass} pl-10`}
            />
          </div>
          <button
            type="submit"
            className="hidden rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 sm:block"
          >
            Search
          </button>
        </form>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
        )}

        {isLoading ? (
          <div className="py-12 text-center text-slate-500">Loading sevaks...</div>
        ) : sevaks.length === 0 ? (
          <div className="py-12 text-center text-slate-500">
            No sevaks found{query ? ' for this search' : ''}.
          </div>
        ) : (
          <>
            <div className="mb-2 text-sm text-slate-500">
              Showing {sevaks.length} of {total} sevak{total === 1 ? '' : 's'}
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {sevaks.map((sevak) => (
                <div
                  key={sevak.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-lg font-bold tracking-wider text-orange-700">
                      {sevak.sevakCode}
                    </span>
                    <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
                      {sevak.expectedContacts} contacts
                    </span>
                  </div>
                  <div className="mb-1 font-medium text-slate-800">{sevak.fullName}</div>
                  <div className="text-sm text-slate-500">{sevak.mobile}</div>
                  <div className="mt-2 text-sm text-slate-400">
                    {sevak.mandal} &middot; {sevak.kshetra}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop / tablet table */}
            <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Code</th>
                    <th className="px-4 py-3 font-medium">Full Name</th>
                    <th className="px-4 py-3 font-medium">Mobile</th>
                    <th className="px-4 py-3 font-medium">Mandal</th>
                    <th className="px-4 py-3 font-medium">Kshetra</th>
                    <th className="px-4 py-3 font-medium">Expected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sevaks.map((sevak) => (
                    <tr key={sevak.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-semibold tracking-wider text-orange-700">
                        {sevak.sevakCode}
                      </td>
                      <td className="px-4 py-3">{sevak.fullName}</td>
                      <td className="px-4 py-3">{sevak.mobile}</td>
                      <td className="px-4 py-3">{sevak.mandal}</td>
                      <td className="px-4 py-3">{sevak.kshetra}</td>
                      <td className="px-4 py-3">{sevak.expectedContacts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {total > 0 && (
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
            )}
          </>
        )}
      </main>
    </div>
  );
}
