"use client";

import { APP_CONFIG } from "@/lib/config";

interface UsernameFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  error?: string | null;
}

export function UsernameForm({ value, onChange, onSubmit, loading, error }: UsernameFormProps) {
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <label className="block">
        <span className="sr-only">X username or profile URL</span>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={APP_CONFIG.inputPlaceholder}
          className="w-full rounded-2xl border border-slate-600 bg-slate-900/70 px-4 py-4 text-lg text-white placeholder:text-slate-400"
          autoComplete="off"
          spellCheck={false}
          disabled={loading}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "username-error" : undefined}
        />
      </label>
      {error ? (
        <p id="username-error" className="text-sm text-rose-300" role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn-primary w-full text-lg" disabled={loading}>
        {loading ? "Analysing…" : APP_CONFIG.primaryButton}
      </button>
      <p className="text-sm text-slate-400">{APP_CONFIG.privacyNote}</p>
    </form>
  );
}
