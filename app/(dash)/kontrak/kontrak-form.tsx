"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import type { KontrakInput } from "@/lib/kontrak";
import { saveKontrak, type KontrakFormState } from "./actions";

type Option = { kode: string; nama: string };
type Props = {
  noRef: number | null;
  noKontrak: string | null;
  initial: KontrakInput;
  customers: Option[];
  lobs: Option[];
};

const rupiah = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

export default function KontrakForm({ noRef, noKontrak, initial, customers, lobs }: Props) {
  const [state, action, pending] = useActionState<KontrakFormState, FormData>(saveKontrak.bind(null, noRef), {});
  const v = state.values ?? initial;
  const e = state.errors ?? {};

  const [recurring, setRecurring] = useState(initial.recurring);
  const [selesai, setSelesai] = useState(initial.selesai);
  const [nilai, setNilai] = useState(
    Number.isFinite(initial.nilaiInvoice) && initial.nilaiInvoice ? rupiah.format(initial.nilaiInvoice) : "",
  );

  // Customer yang tidak lagi bertanda FLAG_CUSTOMER tetap ditampilkan saat edit
  const customerOptions = customers.some((c) => c.kode === initial.customer) || !initial.customer
    ? customers
    : [{ kode: initial.customer, nama: initial.customer }, ...customers];

  const err = (name: keyof KontrakInput) =>
    e[name] && (
      <p id={`${name}-error`} className="mt-1 text-xs text-danger">
        {e[name]}
      </p>
    );
  const invalid = (name: keyof KontrakInput) => ({
    "aria-invalid": Boolean(e[name]),
    "aria-describedby": e[name] ? `${name}-error` : undefined,
    className: `input ${e[name] ? "border-danger" : ""}`,
  });
  // key: paksa input tidak terkontrol memakai nilai terbaru dari server setelah validasi gagal
  const k = (name: keyof KontrakInput) => `${name}-${String(v[name])}`;

  return (
    <form action={action} className="space-y-4">
      {e.form && (
        <p role="alert" className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">
          {e.form}
        </p>
      )}

      <Section title="Data kontrak">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="No. Kontrak" htmlFor="noKontrak">
            <input
              id="noKontrak"
              className="input bg-surface-2 text-ink-2"
              value={noKontrak ?? "Otomatis (YYMM.XXX)"}
              readOnly
              tabIndex={-1}
            />
          </Field>
          <Field label="Tanggal kontrak" htmlFor="tanggal" required>
            <input id="tanggal" name="tanggal" type="date" key={k("tanggal")} defaultValue={v.tanggal} required {...invalid("tanggal")} />
            {err("tanggal")}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer" htmlFor="customer" required>
            <select id="customer" name="customer" key={k("customer")} defaultValue={v.customer} required {...invalid("customer")}>
              <option value="">— Pilih customer —</option>
              {customerOptions.map((c) => (
                <option key={c.kode} value={c.kode}>
                  {c.nama} ({c.kode})
                </option>
              ))}
            </select>
            {err("customer")}
          </Field>
          <Field label="Bidang Usaha" htmlFor="lob" required>
            <select id="lob" name="lob" key={k("lob")} defaultValue={v.lob} required {...invalid("lob")}>
              <option value="">— Pilih bidang usaha —</option>
              {lobs.map((l) => (
                <option key={l.kode} value={l.kode}>
                  {l.kode} — {l.nama}
                </option>
              ))}
            </select>
            {err("lob")}
          </Field>
        </div>

        <Field label="Deskripsi kontrak" htmlFor="deskripsi">
          <textarea
            id="deskripsi"
            name="deskripsi"
            key={k("deskripsi")}
            defaultValue={v.deskripsi}
            rows={4}
            maxLength={2000}
            placeholder="Isi / ruang lingkup kontrak"
            {...invalid("deskripsi")}
          />
          {err("deskripsi")}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nilai invoice" htmlFor="nilaiInvoice" required>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">Rp</span>
              <input
                id="nilaiInvoice"
                name="nilaiInvoice"
                inputMode="decimal"
                value={nilai}
                onChange={(ev) => setNilai(ev.target.value.replace(/[^\d.,]/g, ""))}
                onBlur={() => {
                  const s = nilai.includes(",") ? nilai.replace(/\./g, "").replace(",", ".") : nilai.replace(/\./g, "");
                  if (s && Number.isFinite(Number(s))) setNilai(rupiah.format(Number(s)));
                }}
                placeholder="0"
                required
                {...invalid("nilaiInvoice")}
                className={`${invalid("nilaiInvoice").className} tabular pl-10 text-right`}
              />
            </div>
            {err("nilaiInvoice")}
          </Field>
        </div>
      </Section>

      <Section title="Penagihan">
        <input type="hidden" name="recurring" value={recurring ? "1" : "0"} />
        <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Jenis invoice">
          <Choice checked={!recurring} onSelect={() => setRecurring(false)} title="Invoice 1 kali" desc="Ditagih sekali saja" />
          <Choice checked={recurring} onSelect={() => setRecurring(true)} title="Invoice berulang" desc="Ditagih rutin per periode" />
        </div>

        {recurring && (
          <div className="grid gap-4 rounded-lg bg-surface-2/60 p-4 sm:grid-cols-3">
            <Field label="Tanggal awal invoice" htmlFor="recurringTanggalAwal" required>
              <input
                id="recurringTanggalAwal"
                name="recurringTanggalAwal"
                type="date"
                key={k("recurringTanggalAwal")}
                defaultValue={v.recurringTanggalAwal || v.tanggal}
                required
                {...invalid("recurringTanggalAwal")}
              />
              {err("recurringTanggalAwal")}
            </Field>
            <Field label="Tagih setiap" htmlFor="recurringPeriodeValue" required>
              <div className="flex gap-2">
                <input
                  id="recurringPeriodeValue"
                  name="recurringPeriodeValue"
                  type="number"
                  min={1}
                  max={999}
                  key={k("recurringPeriodeValue")}
                  defaultValue={v.recurringPeriodeValue || 1}
                  required
                  {...invalid("recurringPeriodeValue")}
                  className={`${invalid("recurringPeriodeValue").className} w-24`}
                />
                <select
                  name="recurringPeriode"
                  aria-label="Periode"
                  key={k("recurringPeriode")}
                  defaultValue={v.recurringPeriode}
                  className="input"
                >
                  <option value="BULAN">Bulan</option>
                  <option value="TAHUN">Tahun</option>
                </select>
              </div>
              {err("recurringPeriodeValue")}
            </Field>
          </div>
        )}
      </Section>

      {recurring && (
        <Section title="Status kontrak">
          <input type="hidden" name="selesai" value={selesai ? "1" : "0"} />
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Status kontrak">
            <Choice checked={!selesai} onSelect={() => setSelesai(false)} title="Masih berjalan" desc="Invoice terus diterbitkan" />
            <Choice checked={selesai} onSelect={() => setSelesai(true)} title="Kontrak selesai" desc="Tidak ada invoice lagi" />
          </div>

          {selesai && (
            <div className="grid gap-4 rounded-lg bg-surface-2/60 p-4 sm:grid-cols-[200px_1fr]">
              <Field label="Tanggal selesai" htmlFor="selesaiTanggal" required>
                <input
                  id="selesaiTanggal"
                  name="selesaiTanggal"
                  type="date"
                  key={k("selesaiTanggal")}
                  defaultValue={v.selesaiTanggal}
                  required
                  {...invalid("selesaiTanggal")}
                />
                {err("selesaiTanggal")}
              </Field>
              <Field label="Alasan selesai" htmlFor="selesaiDeskripsi" required>
                <input
                  id="selesaiDeskripsi"
                  name="selesaiDeskripsi"
                  key={k("selesaiDeskripsi")}
                  defaultValue={v.selesaiDeskripsi}
                  maxLength={200}
                  required
                  {...invalid("selesaiDeskripsi")}
                />
                {err("selesaiDeskripsi")}
              </Field>
            </div>
          )}
        </Section>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Link href="/kontrak" className="btn-ghost">
          Batal
        </Link>
        <button className="btn min-w-32" disabled={pending}>
          {pending ? "Menyimpan…" : noRef === null ? "Simpan kontrak" : "Simpan perubahan"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card space-y-4 p-5">
      <h2 className="font-medium">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, htmlFor, required, children }: { label: string; htmlFor: string; required?: boolean; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
    </div>
  );
}

function Choice({ checked, onSelect, title, desc }: { checked: boolean; onSelect: () => void; title: string; desc: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-left transition ${
        checked ? "border-accent bg-accent/5" : "border-line hover:bg-surface-2"
      }`}
    >
      <span
        className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border ${
          checked ? "border-accent" : "border-muted"
        }`}
        aria-hidden
      >
        {checked && <span className="size-2 rounded-full bg-accent" />}
      </span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-ink-2">{desc}</span>
      </span>
    </button>
  );
}
