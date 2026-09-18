"use client";

import { useActionState, useState } from "react";
import { login, type LoginState } from "@/app/actions";

function UserIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-4" aria-hidden>
      <circle cx="10" cy="7" r="3.25" />
      <path d="M3.75 16.5c.9-2.9 3.3-4.5 6.25-4.5s5.35 1.6 6.25 4.5" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-4" aria-hidden>
      <rect x="4" y="8.5" width="12" height="8.5" rx="2" />
      <path d="M6.75 8.5V6.25a3.25 3.25 0 0 1 6.5 0V8.5" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon({ off }: { off?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" className="size-4" aria-hidden>
      <path d="M1.75 10S4.75 4.5 10 4.5 18.25 10 18.25 10 15.25 15.5 10 15.5 1.75 10 1.75 10Z" />
      <circle cx="10" cy="10" r="2.5" />
      {off && <path d="M3 3l14 14" strokeLinecap="round" />}
    </svg>
  );
}

export default function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="userid" className="mb-1.5 block text-sm font-medium">
          User ID
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
            <UserIcon />
          </span>
          <input
            id="userid"
            name="userid"
            className="input h-11 pl-10"
            placeholder="contoh: daniel"
            autoComplete="username"
            autoFocus
            required
            defaultValue={state.userid}
          />
        </div>
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
          Password
        </label>
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted">
            <LockIcon />
          </span>
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            className="input h-11 pr-11 pl-10"
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-1 my-1 flex w-9 items-center justify-center rounded-md text-muted transition hover:bg-surface-2 hover:text-ink"
            aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
          >
            <EyeIcon off={showPassword} />
          </button>
        </div>
      </div>

      {state.error && (
        <p role="alert" className="shake flex items-center gap-2 rounded-lg bg-danger-bg px-3 py-2.5 text-sm text-danger">
          <span aria-hidden>⚠</span>
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="group relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-gradient-to-r from-[#1c5cab] via-[#2a78d6] to-[#3987e5] text-sm font-medium text-white shadow-lg shadow-[#2a78d6]/25 transition hover:shadow-xl hover:shadow-[#2a78d6]/35 disabled:opacity-70"
      >
        <span className="login-shine absolute inset-0" aria-hidden />
        {pending ? (
          <>
            <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
            Memeriksa…
          </>
        ) : (
          <>
            Login
            <span className="transition-transform group-hover:translate-x-0.5" aria-hidden>
              →
            </span>
          </>
        )}
      </button>
    </form>
  );
}
