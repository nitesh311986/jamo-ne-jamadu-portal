import {
  useEffect,
  useState,
  useCallback,
  type ChangeEvent,
  type ReactElement,
} from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  BookOpen,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import api from '../api/axios';
import SevakSearchSelect from '../components/SevakSearchSelect';
import type { Sevak } from '../types/sevak';
import type { BookAllocation } from '../types/book';
import type { ApiError } from '../types/auth';
import type { AxiosError } from 'axios';

interface NewBookRow {
  id: number;
  value: string;
}

const statusClass: Record<string, string> = {
  ASSIGNED:
    'bg-blue-50 text-blue-700',
  SUBMITTED:
    'bg-emerald-50 text-emerald-700',
  PARTIALLY_SUBMITTED:
    'bg-amber-50 text-amber-700',
};

function normalize(value: string): string {
  return value.trim().toUpperCase();
}

export default function BookAllocation(): ReactElement {
  const [selectedSevak, setSelectedSevak] = useState<Sevak | null>(null);
  const [books, setBooks] = useState<BookAllocation[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState<boolean>(false);

  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const [newRows, setNewRows] = useState<NewBookRow[]>([{ id: 1, value: '' }]);
  const [nextId, setNextId] = useState<number>(2);

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const clearMessages = useCallback((): void => {
    setError('');
    setSuccess('');
  }, []);

  const loadBooks = useCallback(async (sevakId: string): Promise<void> => {
    setIsLoadingBooks(true);
    try {
      const { data } = await api.get<{ books: BookAllocation[] }>(
        `/api/v1/books/sevak/${sevakId}`
      );
      setBooks(data.books);
    } catch {
      setError('Failed to load assigned books');
    } finally {
      setIsLoadingBooks(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSevak) {
      void loadBooks(selectedSevak.id);
      clearMessages();
    } else {
      setBooks([]);
    }
  }, [selectedSevak, loadBooks, clearMessages]);

  const handleSelectSevak = (sevak: Sevak): void => {
    setSelectedSevak(sevak);
    setNewRows([{ id: 1, value: '' }]);
    setNextId(2);
  };

  const handleClearSevak = (): void => {
    setSelectedSevak(null);
    setBooks([]);
    setNewRows([{ id: 1, value: '' }]);
    setNextId(2);
    clearMessages();
  };

  const addNewRow = (): void => {
    setNewRows((prev) => [...prev, { id: nextId, value: '' }]);
    setNextId((id) => id + 1);
  };

  const removeNewRow = (id: number): void => {
    setNewRows((prev) => prev.filter((row) => row.id !== id));
  };

  const updateNewRow = (id: number, value: string): void => {
    setNewRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, value } : row))
    );
  };

  const newNormalized = newRows.map((row) => normalize(row.value));
  const existingBookNumbers = new Set(books.map((b) => normalize(b.bookNumber)));

  const duplicateInNew = new Set<string>();
  const seen = new Set<string>();
  for (const n of newNormalized) {
    if (n && seen.has(n)) duplicateInNew.add(n);
    if (n) seen.add(n);
  }

  const handleSaveAll = async (): Promise<void> => {
    if (!selectedSevak) {
      setError('Select a sevak first');
      return;
    }

    const submitted = newRows.map((row) => normalize(row.value));
    const nonEmpty = submitted.filter((v) => v.length > 0);

    if (nonEmpty.length === 0) {
      setError('Enter at least one book number');
      return;
    }

    if (nonEmpty.length !== new Set(nonEmpty).size) {
      setError('Duplicate book numbers are not allowed');
      return;
    }

    const alreadyAssigned = nonEmpty.filter((n) => existingBookNumbers.has(n));
    if (alreadyAssigned.length > 0) {
      setError(`Already assigned to this sevak: ${alreadyAssigned.join(', ')}`);
      return;
    }

    setIsSaving(true);
    clearMessages();

    try {
      await api.post('/api/v1/books/batch-assign', {
        sevakId: selectedSevak.id,
        bookNumbers: nonEmpty,
      });

      setSuccess(`${nonEmpty.length} book${nonEmpty.length === 1 ? '' : 's'} allocated`);
      setNewRows([{ id: nextId, value: '' }]);
      setNextId((id) => id + 1);
      await loadBooks(selectedSevak.id);
    } catch (err) {
      const response = (err as AxiosError<ApiError>).response;
      const message =
        response?.data?.error ??
        (response?.data as { conflicts?: string[] } | undefined)?.conflicts?.join(', ') ??
        'Failed to allocate books';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const startEditing = (book: BookAllocation): void => {
    setEditingBookId(book.id);
    setEditValue(book.bookNumber);
    clearMessages();
  };

  const cancelEditing = (): void => {
    setEditingBookId(null);
    setEditValue('');
  };

  const handleUpdateBook = async (bookId: string): Promise<void> => {
    const normalized = normalize(editValue);
    if (!normalized) {
      setError('Book number is required');
      return;
    }

    const current = books.find((b) => b.id === bookId);
    if (current && normalize(current.bookNumber) === normalized) {
      cancelEditing();
      return;
    }

    const taken = books.find(
      (b) => b.id !== bookId && normalize(b.bookNumber) === normalized
    );
    if (taken) {
      setError('This book number is already assigned to this sevak');
      return;
    }

    setIsSavingEdit(true);
    clearMessages();

    try {
      await api.put(`/api/v1/books/${bookId}`, { bookNumber: normalized });
      setSuccess('Book number updated');
      cancelEditing();
      if (selectedSevak) await loadBooks(selectedSevak.id);
    } catch (err) {
      setError(
        (err as AxiosError<ApiError>).response?.data?.error ??
          'Failed to update book number'
      );
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteBook = async (book: BookAllocation): Promise<void> => {
    if (!window.confirm(`Delete book ${book.bookNumber}?`)) {
      return;
    }

    setIsDeleting(book.id);
    clearMessages();

    try {
      await api.delete(`/api/v1/books/${book.id}`);
      setSuccess(`Book ${book.bookNumber} deleted`);
      if (selectedSevak) await loadBooks(selectedSevak.id);
    } catch (err) {
      setError(
        (err as AxiosError<ApiError>).response?.data?.error ??
          'Failed to delete book'
      );
    } finally {
      setIsDeleting(null);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500';
  const inputErrorClass =
    'w-full rounded-lg border border-red-300 px-3 py-2 text-sm text-red-900 placeholder-red-300 focus:outline-none focus:ring-1 focus:ring-red-500';

  return (
    <div className="space-y-5">
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
            Book Allocation
          </h1>
        </div>
      </div>

      <SevakSearchSelect
        selected={selectedSevak}
        onSelect={handleSelectSevak}
        onClear={handleClearSevak}
      />

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}
      {success && (
        <div className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      {selectedSevak && (
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <BookOpen size={18} className="text-orange-600" />
                <h2 className="font-bold text-slate-800">Assigned Books</h2>
              </div>

              {isLoadingBooks ? (
                <div className="py-8 text-center text-sm text-slate-500">
                  <Loader2 size={18} className="mx-auto mb-2 animate-spin" />
                  Loading books...
                </div>
              ) : books.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-500">
                  No books assigned to this sevak.
                </p>
              ) : (
                <>
                  {/* Mobile cards */}
                  <div className="space-y-3 md:hidden">
                    {books.map((book) => (
                      <div
                        key={book.id}
                        className="rounded-lg border border-slate-100 bg-slate-50 p-3"
                      >
                        {editingBookId === book.id ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={editValue}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                setEditValue(e.target.value)
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  void handleUpdateBook(book.id);
                                }
                              }}
                              className={inputClass}
                            />
                            <button
                              type="button"
                              onClick={() => void handleUpdateBook(book.id)}
                              disabled={isSavingEdit}
                              className="rounded-lg bg-emerald-600 p-2 text-white hover:bg-emerald-700 disabled:opacity-60"
                            >
                              {isSavingEdit ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Save size={14} />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="rounded-lg bg-slate-200 p-2 text-slate-700 hover:bg-slate-300"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-800">
                                {book.bookNumber}
                              </p>
                              <span
                                className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                  statusClass[book.status] ??
                                  'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {book.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => startEditing(book)}
                                className="rounded-lg p-2 text-slate-600 hover:bg-slate-200"
                                aria-label={`Edit book ${book.bookNumber}`}
                              >
                                <Pencil size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDeleteBook(book)}
                                disabled={isDeleting === book.id}
                                className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-60"
                                aria-label={`Delete book ${book.bookNumber}`}
                              >
                                {isDeleting === book.id ? (
                                  <Loader2
                                    size={16}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <Trash2 size={16} />
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden overflow-hidden rounded-lg border border-slate-100 md:block">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-100 text-slate-600">
                        <tr>
                          <th className="px-4 py-3 font-medium">Book No</th>
                          <th className="px-4 py-3 font-medium">Status</th>
                          <th className="px-4 py-3 font-medium">Assigned At</th>
                          <th className="px-4 py-3 font-medium text-right">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {books.map((book) => (
                          <tr key={book.id}>
                            <td className="px-4 py-3 align-top">
                              {editingBookId === book.id ? (
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    setEditValue(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      void handleUpdateBook(book.id);
                                    }
                                  }}
                                  className={inputClass}
                                />
                              ) : (
                                <span className="font-medium tracking-wider text-slate-800">
                                  {book.bookNumber}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 align-top">
                              {editingBookId === book.id ? null : (
                                <span
                                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                    statusClass[book.status] ??
                                    'bg-slate-100 text-slate-700'
                                  }`}
                                >
                                  {book.status}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 align-top text-slate-500">
                              {new Date(book.assignedAt).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="flex items-center justify-end gap-1">
                                {editingBookId === book.id ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => void handleUpdateBook(book.id)}
                                      disabled={isSavingEdit}
                                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                                    >
                                      {isSavingEdit ? 'Saving...' : 'Save'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={cancelEditing}
                                      className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => startEditing(book)}
                                      className="rounded-lg p-2 text-slate-600 hover:bg-slate-100"
                                      aria-label={`Edit book ${book.bookNumber}`}
                                    >
                                      <Pencil size={16} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void handleDeleteBook(book)}
                                      disabled={isDeleting === book.id}
                                      className="rounded-lg p-2 text-red-600 hover:bg-red-50 disabled:opacity-60"
                                      aria-label={`Delete book ${book.bookNumber}`}
                                    >
                                      {isDeleting === book.id ? (
                                        <Loader2
                                          size={16}
                                          className="animate-spin"
                                        />
                                      ) : (
                                        <Trash2 size={16} />
                                      )}
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <Plus size={18} className="text-orange-600" />
                <h2 className="font-bold text-slate-800">Allocate New Books</h2>
              </div>

              <div className="space-y-3">
                {newRows.map((row, index) => {
                  const normalized = normalize(row.value);
                  const isDuplicate = normalized !== '' && duplicateInNew.has(normalized);
                  const isExisting =
                    normalized !== '' && existingBookNumbers.has(normalized);

                  return (
                    <div key={row.id} className="flex items-start gap-2">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={row.value}
                          onChange={(e: ChangeEvent<HTMLInputElement>) =>
                            updateNewRow(row.id, e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (index === newRows.length - 1) addNewRow();
                            }
                          }}
                          placeholder={`Book number ${index + 1}`}
                          className={
                            isDuplicate || isExisting ? inputErrorClass : inputClass
                          }
                        />
                        {isDuplicate && (
                          <p className="mt-1 text-xs text-red-600">
                            Duplicate book number
                          </p>
                        )}
                        {isExisting && (
                          <p className="mt-1 text-xs text-red-600">
                            Already assigned to this sevak
                          </p>
                        )}
                      </div>
                      {newRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeNewRow(row.id)}
                          className="mt-1 rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                          aria-label="Remove row"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={addNewRow}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-200"
                >
                  <Plus size={16} />
                  Add Another Book
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveAll()}
                  disabled={isSaving}
                  className="flex items-center justify-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Save size={16} />
                  )}
                  {isSaving ? 'Saving...' : 'Save All Books'}
                </button>
              </div>
            </section>
          </div>

          <div className="lg:sticky lg:top-24 lg:col-span-1 lg:self-start">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-bold text-slate-800">
                Summary
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Selected Sevak</span>
                  <span className="font-medium text-slate-800">
                    {selectedSevak.sevakCode}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Assigned Books</span>
                  <span className="font-medium text-slate-800">{books.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">New Books</span>
                  <span className="font-medium text-slate-800">
                    {newRows.filter((r) => normalize(r.value).length > 0).length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
