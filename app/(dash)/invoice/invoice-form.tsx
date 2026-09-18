"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { hitungTotal, kaliHarga } from "@/lib/invoice-period";
import { saveInvoice, type InvoiceFormState } from "./actions";

type Props = {
  noRefKontrak: number;
  awal: string | null;
  info: { noKontrak: string; customer: string; customerNama: string; lobNama: string; periodeLabel: string };
  harga: number;
  initial: { tanggal: string; deskripsi: string };
};

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 2 });

export default function InvoiceForm({ noRefKontrak, awal, info, harga, initial }: Props) {
  const [state, action, pending] = useActionState<InvoiceFormState, FormData>(saveInvoice.bind(null, noRefKontrak, awal), {});
  const v = state.values ?? { ...initial, keterangan: "", pctPpn: "0", qty: "1" };
  const e = state.errors ?? {};

  // Qty & PPN dipakai untuk pratinjau total; nilai final tetap dihitung ulang di server
  const [qty, setQty] = useState(v.qty);
  const [pct, setPct] = useState(v.pctPpn);
  const qtyNum = Number(qty) >= 1 ? Math.floor(Number(qty)) : 0;
  const pctNum = Number(pct.replace(",", ".")) || 0;
  const nilaiDetail = kaliHarga(qtyNum, harga);
  const { nilaiPpn, nilaiAkhir } = hitungTotal(nilaiDetail, pctNum);

  const cls = (name: keyof NonNullable<InvoiceFormState["errors"]>) => `input ${e[name] ? "border-danger" : ""}`;
  const err = (name: keyof NonNullable<InvoiceFormState["errors"]>) =>
    e[name] && <p className="mt-1 text-xs text-danger">{e[name]}</p>;
  const ro = "input bg-surface-2 text-ink-2";

  return (
    <form action={action} className="space-y-4">
      {e.form && (
        <p role="alert" className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">
          {e.form}
        </p>
      )}

      <section className="card space-y-4 p-5">
        <h2 className="font-medium">Faktur</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="No. Faktur" htmlFor="noFaktur">
            <input id="noFaktur" className={ro} value="Otomatis (INV/SOS/YYMM/XXX)" readOnly tabIndex={-1} />
          </Field>
          <Field label="Tanggal faktur" htmlFor="tanggal" required>
            <input id="tanggal" name="tanggal" type="date" key={`t-${v.tanggal}`} defaultValue={v.tanggal} required className={cls("tanggal")} />
            {err("tanggal")}
          </Field>
          <Field label="No. Kontrak" htmlFor="noKontrak">
            <input id="noKontrak" className={ro} value={info.noKontrak} readOnly tabIndex={-1} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customer" htmlFor="customer">
            <input id="customer" className={ro} value={`${info.customerNama} (${info.customer})`} readOnly tabIndex={-1} />
          </Field>
          <Field label="Bidang Usaha" htmlFor="lob">
            <input id="lob" className={ro} value={info.lobNama} readOnly tabIndex={-1} />
          </Field>
        </div>
        <Field label="Keterangan" htmlFor="keterangan">
          <input id="keterangan" name="keterangan" key={`k-${v.keterangan}`} defaultValue={v.keterangan} maxLength={200} className={cls("keterangan")} />
          {err("keterangan")}
        </Field>
      </section>

      <section className="card space-y-4 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium">Detail</h2>
          <span className="text-sm text-ink-2">Periode: {info.periodeLabel}</span>
        </div>
        <Field label="Deskripsi" htmlFor="deskripsi" required>
          <textarea
            id="deskripsi"
            name="deskripsi"
            key={`d-${v.deskripsi}`}
            defaultValue={v.deskripsi}
            rows={3}
            maxLength={2000}
            required
            className={cls("deskripsi")}
          />
          {err("deskripsi")}
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Qty" htmlFor="qty" required>
            <input
              id="qty"
              name="qty"
              type="number"
              min={1}
              step={1}
              value={qty}
              onChange={(ev) => setQty(ev.target.value)}
              required
              className={`${cls("qty")} tabular text-right`}
            />
            {err("qty")}
          </Field>
          <Field label="Harga" htmlFor="harga">
            <input id="harga" className={`${ro} tabular text-right`} value={rupiah.format(harga)} readOnly tabIndex={-1} />
          </Field>
          <Field label="Nilai" htmlFor="nilai">
            <input id="nilai" className={`${ro} tabular text-right`} value={rupiah.format(nilaiDetail)} readOnly tabIndex={-1} />
          </Field>
        </div>
      </section>

      <section className="card p-5">
        <dl className="ml-auto max-w-sm space-y-2 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-2">Nilai sebelum PPN</dt>
            <dd className="tabular">{rupiah.format(nilaiDetail)}</dd>
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
                className={`${cls("pctPpn")} tabular w-20 py-1 text-right`}
              />
              %
            </dt>
            <dd className="tabular">{rupiah.format(nilaiPpn)}</dd>
          </div>
          {err("pctPpn")}
          <div className="flex justify-between gap-4 border-t border-line pt-2 text-base font-semibold">
            <dt>Nilai akhir</dt>
            <dd className="tabular">{rupiah.format(nilaiAkhir)}</dd>
          </div>
        </dl>
      </section>

      <div className="flex justify-end gap-2 pt-2">
        <Link href="/invoice" className="btn-ghost">
          Batal
        </Link>
        <button className="btn min-w-32" disabled={pending || qtyNum < 1}>
          {pending ? "Menyimpan…" : "Terbitkan invoice"}
        </button>
      </div>
    </form>
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
