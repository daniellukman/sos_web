"use client";

import { useActionState } from "react";
import { tambahPeriodeAction, type TambahState } from "./actions";

type Props = { perusahaan: string; namaBulan: string[]; tahunList: number[]; tahunDefault: number; bulanDefault: number };

export default function TambahForm({ perusahaan, namaBulan, tahunList, tahunDefault, bulanDefault }: Props) {
  const [state, action, pending] = useActionState<TambahState, FormData>(tambahPeriodeAction.bind(null, perusahaan), {});

  return (
    <form action={action} className="card mb-4 space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">Tambah periode</span>
        <select name="bulan" defaultValue={bulanDefault} className="input w-36" aria-label="Bulan">
          {namaBulan.map((n, i) => (
            <option key={n} value={i + 1}>
              {n}
            </option>
          ))}
          <option value="semua">Semua bulan (1 tahun)</option>
        </select>
        <select name="tahun" defaultValue={tahunDefault} className="input w-28" aria-label="Tahun">
          {tahunList.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" value="1" defaultChecked /> Aktif
        </label>
        <button className="btn" disabled={pending}>
          {pending ? "Menyimpan…" : "+ Tambah"}
        </button>
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
