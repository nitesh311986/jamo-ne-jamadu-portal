import { useState, type FormEvent, type ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Copy, Loader2 } from 'lucide-react';
import api from '../api/axios';
import type { CreateSevakRequest, Sevak, SevakResponse } from '../types/sevak';
import type { ApiError } from '../types/auth';
import type { AxiosError } from 'axios';

interface FormState {
  fullName: string;
  firstName: string;
  lastName: string;
  mobile: string;
  altMobile: string;
  whatsapp: string;
  address: string;
  mandal: string;
  kshetra: string;
  expectedContacts: string;
}

const initialForm: FormState = {
  fullName: '',
  firstName: '',
  lastName: '',
  mobile: '',
  altMobile: '',
  whatsapp: '',
  address: '',
  mandal: '',
  kshetra: '',
  expectedContacts: '',
};

function deriveFirstAndLast(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: parts[0] };
  }
  return { firstName: parts[0], lastName: parts[parts.length - 1] };
}

export default function SevakRegistration(): ReactElement {
  const [form, setForm] = useState<FormState>(initialForm);
  const [error, setError] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [createdSevak, setCreatedSevak] = useState<Sevak | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const handleFullNameChange = (value: string): void => {
    const { firstName, lastName } = deriveFirstAndLast(value);
    setForm((prev) => ({
      ...prev,
      fullName: value,
      firstName,
      lastName,
    }));
  };

  const handleChange = (field: keyof FormState, value: string): void => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setIsSaving(true);

    const expected = parseInt(form.expectedContacts, 10);

    const payload: CreateSevakRequest = {
      fullName: form.fullName.trim(),
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      mobile: form.mobile.trim(),
      altMobile: form.altMobile.trim() || undefined,
      whatsapp: form.whatsapp.trim() || undefined,
      address: form.address.trim(),
      mandal: form.mandal.trim(),
      kshetra: form.kshetra.trim(),
      expectedContacts: Number.isNaN(expected) ? 0 : expected,
    };

    try {
      const response = await api.post<SevakResponse>('/api/v1/sevaks', payload);
      setCreatedSevak(response.data.sevak);
      setForm(initialForm);
    } catch (err) {
      const message = (err as AxiosError<ApiError>).response?.data?.error ?? 'Failed to register sevak';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const copyCode = async (): Promise<void> => {
    if (!createdSevak) return;
    try {
      await navigator.clipboard.writeText(createdSevak.sevakCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-500';
  const readOnlyClass =
    'w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600';

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
            Sevak Registration
          </h1>
        </div>
      </div>

      <main className="mx-auto max-w-3xl">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                પૂરું નામ / Full Name
              </label>
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => handleFullNameChange(e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                પ્રથમ નામ / First Name
              </label>
              <input
                type="text"
                value={form.firstName}
                readOnly
                className={readOnlyClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                છેલ્લું નામ / Last Name
              </label>
              <input
                type="text"
                value={form.lastName}
                readOnly
                className={readOnlyClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                મોબાઇલ / Mobile
              </label>
              <input
                type="tel"
                value={form.mobile}
                onChange={(e) => handleChange('mobile', e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                અન્ય મોબાઇલ / Alt Mobile
              </label>
              <input
                type="tel"
                value={form.altMobile}
                onChange={(e) => handleChange('altMobile', e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                વ્હોટ્સએપ / WhatsApp
              </label>
              <input
                type="tel"
                value={form.whatsapp}
                onChange={(e) => handleChange('whatsapp', e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                અપેક્ષિત સંપર્કો / Expected Contacts
              </label>
              <input
                type="number"
                min={0}
                value={form.expectedContacts}
                onChange={(e) => handleChange('expectedContacts', e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                સરનામું / Address
              </label>
              <textarea
                value={form.address}
                onChange={(e) => handleChange('address', e.target.value)}
                required
                rows={3}
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                મંડળ / Mandal
              </label>
              <input
                type="text"
                value={form.mandal}
                onChange={(e) => handleChange('mandal', e.target.value)}
                required
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                ક્ષેત્ર / Kshetra
              </label>
              <input
                type="text"
                value={form.kshetra}
                onChange={(e) => handleChange('kshetra', e.target.value)}
                required
                className={inputClass}
              />
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={18} className="animate-spin" />
                Saving...
              </span>
            ) : (
              'Register Sevak'
            )}
          </button>
        </form>
      </main>

      {createdSevak && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
              <Check size={28} />
            </div>
            <h2 className="mb-1 text-lg font-semibold text-slate-800">
              Registration Successful
            </h2>
            <p className="mb-4 text-sm text-slate-500">
              Share this unique 6-character code with the sevak.
            </p>

            <div className="mb-6 flex items-center justify-center gap-3 rounded-xl bg-slate-100 p-4">
              <span className="text-2xl font-bold tracking-wider text-orange-700">
                {createdSevak.sevakCode}
              </span>
              <button
                onClick={copyCode}
                className="rounded-lg p-2 text-slate-600 hover:bg-slate-200"
                title="Copy code"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>

            <button
              onClick={() => setCreatedSevak(null)}
              className="w-full rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-900"
            >
              Register Another
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
