import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getContext } from "@/lib/context";
import { getKontrak } from "@/lib/kontrak";
import { getCustomerNama } from "@/lib/queries";
import ProgressForm from "../progress-form";

export const metadata: Metadata = { title: "Tambah Progress" };

export default async function NewProgressPage({ params }: PageProps<"/kontrak/[noRef]/progress/baru">) {
  await getContext();
  const noRef = Number((await params).noRef);
  if (!Number.isInteger(noRef)) notFound();
  const kontrak = await getKontrak(noRef);
  if (!kontrak) notFound();

  const customerNama = (await getCustomerNama(kontrak.customer)) ?? kontrak.customer;
  const kontrakLabel = `${kontrak.noKontrak || `#${noRef}`} — ${customerNama || "-"}`;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/kontrak/${noRef}#progress`} className="mb-4 inline-block text-sm text-accent-ink hover:underline">
        ← Kembali ke kontrak
      </Link>
      <PageHeader title="Tambah Progress" description={`Kontrak ${kontrakLabel}`} />
      <ProgressForm
        noRef={noRef}
        item={null}
        kontrakLabel={kontrakLabel}
        initial={{ tanggal: today, deskripsi: "" }}
        today={today}
        docs={[]}
      />
    </div>
  );
}
