import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getContext } from "@/lib/context";
import { getCustomerOptions, getLobOptions } from "@/lib/kontrak";
import KontrakForm from "../kontrak-form";

export const metadata: Metadata = { title: "Tambah Kontrak" };

export default async function NewKontrakPage({ searchParams }: PageProps<"/kontrak/baru">) {
  await getContext();
  const [customers, lobs] = await Promise.all([getCustomerOptions(), getLobOptions()]);
  const customer = (await searchParams).customer;

  // Tanggal hari ini (WIB)
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/kontrak" className="mb-4 inline-block text-sm text-accent-ink hover:underline">
        ← Kembali ke daftar
      </Link>
      <PageHeader title="Tambah Kontrak" description="No. Kontrak dibuat otomatis saat disimpan." />
      <KontrakForm
        noRef={null}
        noKontrak={null}
        customers={customers}
        lobs={lobs}
        initial={{
          tanggal: today,
          customer: typeof customer === "string" ? customer : "",
          lob: "",
          deskripsi: "",
          nilaiInvoice: NaN,
          recurring: false,
          recurringTanggalAwal: "",
          recurringPeriode: "BULAN",
          recurringPeriodeValue: 1,
          selesai: false,
          selesaiTanggal: "",
          selesaiDeskripsi: "",
        }}
      />
    </div>
  );
}
