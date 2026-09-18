import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import StatusBayarBadge from "@/components/status-bayar";
import { PageHeader, td, th } from "@/components/ui";
import { getContext } from "@/lib/context";
import { getFaktur } from "@/lib/faktur";
import { formatRupiah, formatTanggal, formatTanggalJam } from "@/lib/format";
import FakturForm from "../faktur-form";

export const metadata: Metadata = { title: "Invoice" };

const periode = (awal: string, akhir: string) => (awal && akhir ? `${formatTanggal(awal)} – ${formatTanggal(akhir)}` : null);

export default async function FakturDetailPage({ params, searchParams }: PageProps<"/faktur/[noRef]">) {
  await getContext();
  const noRef = Number((await params).noRef);
  if (!Number.isInteger(noRef)) notFound();
  const f = await getFaktur(noRef);
  if (!f) notFound();
  const saved = (await searchParams).saved === "1";

  const info: [string, string][] = [
    ["Tanggal", formatTanggal(f.tanggal)],
    ["Customer", `${f.customerNama ?? "-"}${f.customer ? ` (${f.customer})` : ""}`],
    ["No. Kontrak", f.noKontrak || "-"],
    ["Bidang Usaha", f.lobNama ?? f.lob ?? "-"],
    ["Keterangan", f.keterangan || "-"],
    ["Dibayar", formatRupiah(f.nilaiDibayar)],
  ];

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/faktur" className="mb-4 inline-block text-sm text-accent-ink hover:underline">
        ← Kembali ke daftar
      </Link>
      <PageHeader title={f.noFaktur || `Invoice #${noRef}`} description={`No. Ref ${noRef}`}>
        <div className="flex items-center gap-3">
          <StatusBayarBadge status={f.status} />
          <a href={`/cetak/faktur/${noRef}`} target="_blank" rel="noopener" className="btn">
            🖨 Cetak
          </a>
        </div>
      </PageHeader>

      {saved && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-lg bg-good-bg px-4 py-3 text-sm text-good">
          <span aria-hidden>✓</span> Invoice berhasil disimpan.
        </p>
      )}

      <dl className="mb-4 grid gap-x-6 gap-y-1 rounded-lg border border-line px-5 py-3 text-xs text-ink-2 sm:grid-cols-2">
        <div>
          <dt className="inline">Dibuat: </dt>
          <dd className="inline text-ink">
            {f.createUserid ?? "-"} · {formatTanggalJam(f.createDate)}
          </dd>
        </div>
        <div>
          <dt className="inline">Terakhir disimpan: </dt>
          <dd className="inline text-ink">
            {f.updateUserid ?? "-"} · {formatTanggalJam(f.updateDate)}
          </dd>
        </div>
      </dl>

      {f.bisaEdit ? (
        <>
          <section className="card mb-4 grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-3">
            {info.slice(1, 4).map(([k, val]) => (
              <div key={k}>
                <div className="text-xs text-muted">{k}</div>
                <div>{val}</div>
              </div>
            ))}
          </section>
          <FakturForm
            noRef={noRef}
            initial={{ tanggal: f.tanggal, keterangan: f.keterangan, pctPpn: f.pctPpn }}
            lines={f.lines.map((l) => ({
              item: l.item,
              deskripsi: l.deskripsi,
              qty: l.qty,
              harga: l.harga,
              periode: periode(l.tanggalAwal, l.tanggalAkhir),
            }))}
          />
        </>
      ) : (
        <>
          <p className="mb-4 rounded-lg bg-surface-2 px-4 py-3 text-sm text-ink-2">{f.alasanTidakBisaEdit}</p>
          <section className="card mb-4 grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-3">
            {info.map(([k, val]) => (
              <div key={k}>
                <div className="text-xs text-muted">{k}</div>
                <div>{val}</div>
              </div>
            ))}
          </section>
          <section className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-line bg-surface-2/50">
                  <tr>
                    <th className={th}>#</th>
                    <th className={th}>Deskripsi</th>
                    <th className={th}>Periode</th>
                    <th className={`${th} text-right`}>Qty</th>
                    <th className={`${th} text-right`}>Harga</th>
                    <th className={`${th} text-right`}>Nilai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {f.lines.map((l) => (
                    <tr key={l.item}>
                      <td className={`${td} text-muted`}>{l.item}</td>
                      <td className={`${td} whitespace-pre-line`}>{l.deskripsi || "-"}</td>
                      <td className={`${td} whitespace-nowrap text-ink-2`}>{periode(l.tanggalAwal, l.tanggalAkhir) ?? "-"}</td>
                      <td className={`${td} tabular text-right`}>{l.qty}</td>
                      <td className={`${td} tabular text-right whitespace-nowrap`}>{formatRupiah(l.harga)}</td>
                      <td className={`${td} tabular text-right whitespace-nowrap`}>{formatRupiah(l.nilai)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-line text-sm">
                  <tr>
                    <td colSpan={5} className="px-4 py-2 text-right text-ink-2">
                      Nilai sebelum PPN
                    </td>
                    <td className="tabular px-4 py-2 text-right">{formatRupiah(f.nilaiSebelumPpn)}</td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="px-4 py-2 text-right text-ink-2">
                      PPN {f.pctPpn}%
                    </td>
                    <td className="tabular px-4 py-2 text-right">{formatRupiah(f.nilaiPpn)}</td>
                  </tr>
                  <tr className="font-semibold">
                    <td colSpan={5} className="px-4 py-2 text-right">
                      Nilai akhir
                    </td>
                    <td className="tabular px-4 py-2 text-right">{formatRupiah(f.nilaiAkhir)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
