import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getContext } from "@/lib/context";
import { getOutstandingOne } from "@/lib/invoice";
import { deskripsiDefault, labelPeriode } from "@/lib/invoice-text";
import InvoiceForm from "../invoice-form";

export const metadata: Metadata = { title: "Buat Invoice" };

export default async function NewInvoicePage({ searchParams }: PageProps<"/invoice/baru">) {
  await getContext();
  const sp = await searchParams;
  const noRef = Number(sp.kontrak);
  const awal = typeof sp.awal === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.awal) ? sp.awal : null;
  const outstanding = Number.isInteger(noRef) ? await getOutstandingOne(noRef, awal) : null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/invoice" className="mb-4 inline-block text-sm text-accent-ink hover:underline">
        ← Kembali ke outstanding invoice
      </Link>
      <PageHeader title="Buat Invoice" />

      {!outstanding ? (
        <div className="card px-5 py-10 text-center text-sm text-muted">
          Tagihan ini tidak ditemukan atau sudah dibuatkan invoice.
        </div>
      ) : (
        <InvoiceForm
          noRefKontrak={noRef}
          awal={awal}
          harga={outstanding.kontrak.nilaiInvoice}
          info={{
            noKontrak: outstanding.kontrak.noKontrak,
            customer: outstanding.kontrak.customer,
            customerNama: outstanding.kontrak.customerNama ?? "-",
            lobNama: outstanding.kontrak.lobNama ?? outstanding.kontrak.lob,
            periodeLabel: labelPeriode(outstanding.periode),
          }}
          initial={{ tanggal: today, deskripsi: deskripsiDefault(outstanding.kontrak, outstanding.periode) }}
        />
      )}
    </div>
  );
}
