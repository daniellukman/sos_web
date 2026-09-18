"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { hitungTotal, kaliHarga } from "@/lib/invoice-period";
import { saveFaktur, type FakturFormState } from "./actions";

type Line = { item: number; deskripsi: string; qty: number; harga: number; periode: string | null };
type Props = {
  noRef: number;
  initial: { tanggal: string; keterangan: string; pctPpn: number };
  lines: Line[];
};

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 2 });

export default function FakturForm({ noRef, initial, lines }: Props) {
  const items = lines.map((l) => l.item);
  const [state, action, pending] = useActionState<FakturFormState, FormData>(saveFaktur.bind(null, noRef, items), {});
  const e = state.errors ?? {};

  // Qty & PPN dikontrol untuk pratinjau total; nilai final dihitung ulang di server
  const [qty, setQty] = useState<Record<number, string>>(Object.fromEntries(lines.map((l) => [l.item, String(l.qty)])));
  const [pct, setPct] = useState(String(initial.pctPpn));
  const nilai = (l: Line) => kaliHarga(Number(qty[l.item]) >= 1 ? Math.floor(Number(qty[l.item])) : 0, l.harga);
  const nilaiSebelumPpn = Math.round(lines.reduce((s, l) => s + nilai(l), 0) * 100) / 100;
  const { nilaiPpn, nilaiAkhir } = hitungTotal(nilaiSebelumPpn, Number(pct.replace(",", ".")) || 0);

  const v = state.values;
  const ro = "input bg-surface-2 text-ink-2";

  return (
    <form action={action} className="space-y-4">
      {e.form && (
        <p role="alert" className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">
          {e.form}
        </p>
      )}

      <section className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-[220px_1fr]">
          <Field label="Tanggal faktur" htmlFor="tanggal" required error={e.tanggal}>
            <input
              id="tanggal"
              name="tanggal"
              type="date"
              key={`t-${v?.tanggal ?? initial.tanggal}`}
              defaultValue={v?.tanggal ?? initial.tanggal}
              required
              className={`input ${e.tanggal ? "border-danger" : ""}`}
            />
          </Field>
          <Field label="Keterangan" htmlFor="keterangan" error={e.keterangan}>
            <input
              id="keterangan"
              name="keterangan"
              key={`k-${v?.keterangan ?? initial.keterangan}`}
              defaultValue={v?.keterangan ?? initial.keterangan}
              maxLength={200}
              className={`input ${e.keterangan ? "border-danger" : ""}`}
            />
          </Field>
        </div>
      </section>

      {lines.map((l) => {
        const sv = v?.lines.find((x) => x.item === l.item);
        return (
          <section key={l.item} className="card space-y-4 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-medium">Baris {l.item}</h2>
              {l.periode && <span className="text-sm text-ink-2">Periode: {l.periode}</span>}
            </div>
            <Field label="Deskripsi" htmlFor={`deskripsi-${l.item}`} required>
              <textarea
                id={`deskripsi-${l.item}`}
                name={`deskripsi-${l.item}`}
                key={`d-${sv?.deskripsi ?? l.deskripsi}`}
                defaultValue={sv?.deskripsi ?? l.deskripsi}
                rows={3}
                maxLength={2000}
                required
                className="input"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Qty" htmlFor={`qty-${l.item}`} required>
                <input
                  id={`qty-${l.item}`}
                  name={`qty-${l.item}`}
                  type="number"
                  min={1}
                  step={1}
                  value={qty[l.item]}
                  onChange={(ev) => setQty((q) => ({ ...q, [l.item]: ev.target.value }))}
                  required
                  className="input tabular text-right"
                />
              </Field>
              <Field label="Harga" htmlFor={`harga-${l.item}`}>
                <input id={`harga-${l.item}`} className={`${ro} tabular text-right`} value={rupiah.format(l.harga)} readOnly tabIndex={-1} />
              </Field>
              <Field label="Nilai" htmlFor={`nilai-${l.item}`}>
                <input id={`nilai-${l.item}`} className={`${ro} tabular text-right`} value={rupiah.format(nilai(l))} readOnly tabIndex={-1} />
              </Field>
            </div>
            {e.lines?.[l.item] && <p className="text-xs text-danger">{e.lines[l.item]}</p>}
          </section>
        );
      })}

      <section className="card p-5">
        <dl className="ml-auto max-w-sm space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-2">Nilai sebelum PPN</dt>
            <dd className="tabular">{rupiah.format(nilaiSebelumPpn)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="flex items-center gap-2 text-ink-2">
              <label htmlFor="pctPpn">PPN</label>
              <input
                id="pctPpn"
                name="pctPpn"
                inputMode="decimal"
                value={pct}
                onChange={(ev) => setPct(ev.target.value.replace(/[^\d.,]/g, ""))}
                className={`input tabular w-20 py-1 text-right ${e.pctPpn ? "border-danger" : ""}`}
              />
              %
            </dt>
            <dd className="tabular">{rupiah.format(nilaiPpn)}</dd>
          </div>
          {e.pctPpn && <p className="text-xs text-danger">{e.pctPpn}</p>}
          <div className="flex justify-between gap-4 border-t border-line pt-2 text-base font-semibold">
            <dt>Nilai akhir</dt>
            <dd className="tabular">{rupiah.format(nilaiAkhir)}</dd>
          </div>
        </dl>
      </section>

      <div className="flex justify-end gap-2 pt-2">
        <Link href="/faktur" className="btn-ghost">
          Batal
        </Link>
        <button className="btn min-w-32" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan perubahan"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  required,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </div>
  );
}
