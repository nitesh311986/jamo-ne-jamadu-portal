import {
  useEffect,
  useState,
  useRef,
  type ChangeEvent,
  type ReactElement,
} from 'react';
import { Search, X, User } from 'lucide-react';
import api from '../api/axios';
import type { Sevak, SevakSearchResponse } from '../types/sevak';

interface SevakSearchSelectProps {
  selected: Sevak | null;
  onSelect: (sevak: Sevak) => void;
  onClear: () => void;
}

export default function SevakSearchSelect({
  selected,
  onSelect,
  onClear,
}: SevakSearchSelectProps): ReactElement {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<Sevak[]>([]);
  const [showDropdown, setShowDropdown] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get<SevakSearchResponse>('/api/v1/sevaks/search', {
          params: { q: query.trim(), page: 1, limit: 5 },
        });
        setResults(data.sevaks);
        setShowDropdown(true);
      } catch {
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (sevak: Sevak): void => {
    onSelect(sevak);
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  };

  const handleClear = (): void => {
    onClear();
    setQuery('');
    setResults([]);
    setShowDropdown(false);
  };

  if (selected) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3 sm:items-center">
          <div className="flex items-start gap-3 sm:items-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <User size={20} />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">
                {selected.sevakCode} — {selected.fullName}
              </p>
              <p className="text-xs text-slate-500">
                {selected.mobile} &middot; {selected.mandal} &middot; {selected.kshetra}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
          >
            <X size={14} />
            Change Sevak
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor="sevak-search" className="sr-only">
        Search sevak
      </label>
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          size={18}
        />
        <input
          id="sevak-search"
          type="text"
          value={query}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => setShowDropdown(results.length > 0)}
          placeholder="Search by sevak code, mobile, or full name"
          className="w-full rounded-lg border border-slate-300 py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500"
        />
        {isLoading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            Loading...
          </span>
        )}
      </div>

      {showDropdown && (
        <div
          className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg"
          role="listbox"
        >
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500">
              {query.trim() ? 'No sevaks found' : 'Start typing to search'}
            </div>
          ) : (
            results.map((sevak) => (
              <button
                key={sevak.id}
                type="button"
                onClick={() => handleSelect(sevak)}
                className="w-full px-4 py-3 text-left text-sm hover:bg-slate-50"
                role="option"
              >
                <span className="font-semibold text-orange-700">{sevak.sevakCode}</span>
                <span className="ml-2 text-slate-700">{sevak.fullName}</span>
                <span className="ml-2 block text-xs text-slate-500 sm:inline">
                  {sevak.mobile} &middot; {sevak.mandal} &middot; {sevak.kshetra}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
