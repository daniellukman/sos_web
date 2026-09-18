import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getContext } from "@/lib/context";
import { formatTanggalJam } from "@/lib/format";
import { getKontrak } from "@/lib/kontrak";
import { getProgress } from "@/lib/progress";
import { getCustomerNama } from "@/lib/queries";
import ProgressForm from "../progress-form";

export const metadata: Metadata = { title: "Edit Progress" };

export default async function EditProgressPage({ params }: PageProps<"/kontrak/[noRef]/progress/[item]">) {
  await getContext();
  const p = await params;
  const noRef = Number(p.noRef);
  const item = Number(p.item);
  if (!Number.isInteger(noRef) || !Number.isInteger(item)) notFound();

  const [kontrak, progress] = await Promise.all([getKontrak(noRef), getProgress(noRef, item)]);
  if (!kontrak || !progress) notFound();
  const customerNama = (await getCustomerNama(kontrak.customer)) ?? kontrak.customer;
  const kontrakLabel = `${kontrak.noKontrak || `#${noRef}`} — ${customerNama || "-"}`;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

  return (
    <div className="mx-auto max-w-3xl">
      <Link href={`/kontrak/${noRef}#progress`} className="mb-4 inline-block text-sm text-accent-ink hover:underline">
        ← Kembali ke kontrak
      </Link>
      <PageHeader title={`Progress ${item}`} description={`Kontrak ${kontrakLabel}`} />

      <dl className="mb-4 grid gap-x-6 gap-y-1 rounded-lg border border-line px-5 py-3 text-xs text-ink-2 sm:grid-cols-2">
        <div>
          <dt className="inline">Dibuat: </dt>
          <dd className="inline text-ink">
            {progress.createUserid ?? "-"} · {formatTanggalJam(progress.createDate)}
          </dd>
        </div>
        <div>
          <dt className="inline">Terakhir disimpan: </dt>
          <dd className="inline text-ink">
            {progress.updateUserid ?? "-"} · {formatTanggalJam(progress.updateDate)}
          </dd>
        </div>
      </dl>

      <ProgressForm
        noRef={noRef}
        item={item}
        kontrakLabel={kontrakLabel}
        initial={{ tanggal: progress.tanggal, deskripsi: progress.deskripsi }}
        today={today}
        docs={progress.docs}
      />
    </div>
  );
}
