"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { CustomerInput } from "@/lib/customers";
import { saveCustomer, type CustomerFormState } from "./actions";

type Props = { mode: "create" | "edit"; initial: CustomerInput };

export default function CustomerForm({ mode, initial }: Props) {
  const [state, action, pending] = useActionState<CustomerFormState, FormData>(
    saveCustomer.bind(null, mode),
    {},
  );
  const v = { ...initial, ...state.values };
  const e = state.errors ?? {};

  const text = (
    name: keyof typeof e & keyof CustomerInput,
    label: string,
    opts: { max: number; required?: boolean; type?: string; placeholder?: string; readOnly?: boolean; className?: string },
  ) => (
    <div className={opts.className}>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium">
        {label} {opts.required && <span className="text-danger">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={opts.type ?? "text"}
        // key memaksa nilai di-reset saat server mengembalikan values baru
        key={`${name}-${String(v[name])}`}
        defaultValue={String(v[name] ?? "")}
        maxLength={opts.max}
        required={opts.required}
        readOnly={opts.readOnly}
        placeholder={opts.placeholder}
        aria-invalid={Boolean(e[name])}
        aria-describedby={e[name] ? `${name}-error` : undefined}
        className={`input ${opts.readOnly ? "bg-surface-2 text-ink-2" : ""} ${e[name] ? "border-danger" : ""}`}
      />
      {e[name] && (
        <p id={`${name}-error`} className="mt-1 text-xs text-danger">
          {e[name]}
        </p>
      )}
    </div>
  );

  const check = (name: keyof CustomerInput, label: string) => (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-line px-3 py-2.5 text-sm transition hover:bg-surface-2 has-[:checked]:border-accent has-[:checked]:bg-accent/5">
      <input
        type="checkbox"
        name={name}
        key={`${name}-${String(v[name])}`}
        defaultChecked={Boolean(v[name])}
        className="size-4 accent-[var(--accent)]"
      />
      {label}
    </label>
  );

  return (
    <form action={action} className="space-y-4">
      {e.form && (
        <p role="alert" className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">
          {e.form}
        </p>
      )}

      <Section title="Data utama">
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          {text("kode", "Kode", { max: 20, required: true, readOnly: mode === "edit" })}
          {text("nama", "Nama", { max: 300, required: true, placeholder: "PT / CV / nama perorangan" })}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {text("contact", "Contact person", { max: 100 })}
          {text("telp", "Telepon", { max: 50, type: "tel" })}
          {text("email", "Email", { max: 100, type: "email" })}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {text("fax", "Fax", { max: 50 })}
          {text("affiliasi", "Affiliasi", { max: 10 })}
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium">Jenis</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {check("flagCustomer", "Customer")}
            {check("flagSupplier", "Supplier")}
            {check("flagMitra", "Mitra")}
            {check("flagSales", "Sales")}
          </div>
        </div>
      </Section>

      <Section title="Perpajakan">
        <div className="grid gap-4 sm:grid-cols-[auto_1fr_1fr] sm:items-end">
          {check("pkp", "PKP")}
          {text("npwp", "NPWP", { max: 50, placeholder: "16 digit" })}
          {text("noKtp", "No. KTP", { max: 50 })}
        </div>
        {text("namaPpn", "Nama untuk faktur pajak", { max: 300, placeholder: "Kosongkan jika sama dengan nama" })}
        {text("alamatPpn1", "Alamat pajak", { max: 200, placeholder: "Baris 1" })}
        <div className="grid gap-4 sm:grid-cols-2">
          {text("alamatPpn2", "", { max: 200, placeholder: "Baris 2" })}
          {text("alamatPpn3", "", { max: 200, placeholder: "Baris 3" })}
        </div>
      </Section>

      <Section title="Rekening bank">
        <div className="grid gap-4 sm:grid-cols-3">
          {text("bank", "Bank", { max: 100 })}
          {text("noRekening", "No. rekening", { max: 100 })}
          {text("namaRekening", "Atas nama", { max: 100 })}
        </div>
      </Section>

      <div className="flex justify-end gap-2 pt-2">
        <Link href="/customer" className="btn-ghost">
          Batal
        </Link>
        <button className="btn min-w-32" disabled={pending}>
          {pending ? "Menyimpan…" : mode === "create" ? "Simpan customer" : "Simpan perubahan"}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4 p-5">
      <h2 className="font-medium">{title}</h2>
      {children}
    </section>
  );
}
