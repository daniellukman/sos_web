import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getContext } from "@/lib/context";
import DocList from "@/components/doc-list";
import { formatTanggal, formatTanggalJam } from "@/lib/format";
import { getCustomerOptions, getKontrak, getLobOptions } from "@/lib/kontrak";
import { getProgressList } from "@/lib/progress";
import KontrakForm from "../kontrak-form";

export const metadata: Metadata = { title: "Edit Kontrak" };

export default async function EditKontrakPage({ params, searchParams }: PageProps<"/kontrak/[noRef]">) {
  await getContext();
  const noRef = Number((await params).noRef);
  if (!Number.isInteger(noRef)) notFound();

  const [kontrak, customers, lobs, progress] = await Promise.all([
    getKontrak(noRef),
    getCustomerOptions(),
    getLobOptions(),
    getProgressList(noRef),
  ]);
  if (!kontrak) notFound();
  const sp = await searchParams;
  const saved = sp.saved === "1";
  const savedProgress = typeof sp.progress === "string" ? sp.progress : null;
  const { createUserid, createDate, updateUserid, updateDate, noKontrak, ...initial } = kontrak;

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/kontrak" className="mb-4 inline-block text-sm text-accent-ink hover:underline">
        ← Kembali ke daftar
      </Link>
      <PageHeader title={`Kontrak ${noKontrak || `#${noRef}`}`} description={`No. Ref ${noRef}`} />

      {saved && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-lg bg-good-bg px-4 py-3 text-sm text-good">
          <span aria-hidden>✓</span> Kontrak berhasil disimpan.
        </p>
      )}

      <dl className="mb-4 grid gap-x-6 gap-y-1 rounded-lg border border-line px-5 py-3 text-xs text-ink-2 sm:grid-cols-2">
        <div>
          <dt className="inline">Dibuat: </dt>
          <dd className="inline text-ink">
            {createUserid ?? "-"} · {formatTanggalJam(createDate)}
          </dd>
        </div>
        <div>
          <dt className="inline">Terakhir disimpan: </dt>
          <dd className="inline text-ink">
            {updateUserid ?? "-"} · {formatTanggalJam(updateDate)}
          </dd>
        </div>
      </dl>

      <KontrakForm noRef={noRef} noKontrak={noKontrak} initial={initial} customers={customers} lobs={lobs} />

      <section id="progress" className="mt-10 scroll-mt-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Progress kontrak</h2>
            <p className="text-sm text-ink-2">Catatan perkembangan dan dokumen pendukung</p>
          </div>
          <Link href={`/kontrak/${noRef}/progress/baru`} className="btn">
            + Tambah progress
          </Link>
        </div>

        {savedProgress && (
          <p role="status" className="mb-4 flex items-center gap-2 rounded-lg bg-good-bg px-4 py-3 text-sm text-good">
            <span aria-hidden>✓</span> Progress {savedProgress} berhasil disimpan.
          </p>
        )}

        {progress.length === 0 ? (
          <div className="card px-5 py-10 text-center text-sm text-muted">Belum ada progress untuk kontrak ini.</div>
        ) : (
          <ol className="space-y-3">
            {progress.map((p) => (
              <li key={p.item} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 items-center justify-center rounded-full bg-accent/10 text-sm font-semibold text-accent-ink">
                      {p.item}
                    </span>
                    <div>
                      <p className="font-medium">{formatTanggal(p.tanggal)}</p>
                      <p className="text-xs text-muted">
                        {p.updateUserid ?? p.createUserid ?? "-"} · disimpan {formatTanggalJam(p.updateDate ?? p.createDate)}
                      </p>
                    </div>
                  </div>
                  <Link href={`/kontrak/${noRef}/progress/${p.item}`} className="btn-ghost py-1.5">
                    Edit
                  </Link>
                </div>
                <p className="mt-3 text-sm whitespace-pre-line">{p.deskripsi}</p>
                {p.docs.length > 0 && (
                  <div className="mt-4">
                    <DocList noRef={noRef} item={p.item} docs={p.docs} />
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
