"use client";

import { useActionState } from "react";
import { gantiPassword, type PasswordState } from "./actions";

export default function PasswordForm({ min }: { min: number }) {
  const [state, action, pending] = useActionState<PasswordState, FormData>(gantiPassword, {});
  const cls = (f: PasswordState["field"]) => `input ${state.field === f ? "border-danger" : ""}`;

  if (state.ok) {
    return (
      <p role="status" className="card px-5 py-4 text-sm text-good">
        ✓ Password berhasil diganti. Gunakan password baru saat login berikutnya (web maupun aplikasi desktop).
      </p>
    );
  }

  return (
    <form action={action} className="card space-y-4 p-5">
      {state.error && (
        <p role="alert" className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="lama" className="mb-1.5 block text-sm font-medium">
          Password lama
        </label>
        <input id="lama" name="lama" type="password" autoComplete="current-password" required className={cls("lama")} />
      </div>
      <div>
        <label htmlFor="baru" className="mb-1.5 block text-sm font-medium">
          Password baru
        </label>
        <input id="baru" name="baru" type="password" autoComplete="new-password" minLength={min} maxLength={72} required className={cls("baru")} />
        <p className="mt-1 text-xs text-muted">Minimal {min} karakter.</p>
      </div>
      <div>
        <label htmlFor="ulang" className="mb-1.5 block text-sm font-medium">
          Ulangi password baru
        </label>
        <input id="ulang" name="ulang" type="password" autoComplete="new-password" minLength={min} maxLength={72} required className={cls("ulang")} />
      </div>
      <div className="flex justify-end">
        <button className="btn min-w-32" disabled={pending}>
          {pending ? "Menyimpan…" : "Ganti password"}
        </button>
      </div>
    </form>
  );
}
