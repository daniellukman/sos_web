import type { Metadata } from "next";
import Link from "next/link";
import { EmptyRow, PageHeader, td, th } from "@/components/ui";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { getGlTahun, getJurnalList, labelPeriode, parseGlPeriode } from "@/lib/gl";
import { getGlContext, glPath } from "@/lib/gl-context";
import { angka } from "../akun-cell";
import PeriodeForm from "../periode-form";

export const metadata: Metadata = { title: "GL — Jurnal" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v.trim() : "");

export default async function JurnalListPage({ params, searchParams }: PageProps<"/gl/[perusahaan]/jurnal">) {
  const { perusahaan } = await params;
  await getGlContext(perusahaan);
  const sp = await searchParams;
  const tahunList = await getGlTahun(perusahaan);
  const periode = parseGlPeriode((k) => sp[k], tahunList);
  const q = str(sp.q).slice(0, 100);
  const rows = await getJurnalList(perusahaan, periode, q);
  const base = glPath(perusahaan, "/jurnal");
  const deleted = str(sp.deleted);
  const copied = Number(str(sp.copied));

  return (
    <>
      <PageHeader title="Jurnal" description={`Daftar jurnal ${labelPeriode(periode)}`}>
        <Link href={`${base}/baru`} className="btn">
          + Input jurnal
        </Link>
      </PageHeader>

      {deleted && (
        <p role="status" className="mb-4 rounded-lg bg-good-bg px-4 py-3 text-sm text-good">
          ✓ Jurnal {deleted} sudah dihapus.
        </p>
      )}
      {copied > 0 && (
        <p role="status" className="mb-4 rounded-lg bg-good-bg px-4 py-3 text-sm text-good">
          ✓ {copied} jurnal berhasil dicopy.
        </p>
      )}

      <PeriodeForm periode={periode} tahunList={tahunList} resetHref={base} extra={<input name="q" defaultValue={q} placeholder="Cari no. jurnal, keterangan…" className="input min-w-64 flex-1" />} />

      <div className="card overflow-hidden">
        <div className="px-5 py-3 text-sm text-ink-2">
          {rows.length} jurnal · Saldo di Neraca Saldo diperbarui oleh proses posting terpisah
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-y border-line bg-surface-2/50">
              <tr>
                <th className={th}>Tanggal</th>
                <th className={th}>No. Jurnal</th>
                <th className={th}>Jenis</th>
                <th className={th}>Keterangan</th>
                <th className={`${th} text-right`}>Nilai</th>
                <th className={`${th} text-right`}>Foto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && <EmptyRow colSpan={6}>Tidak ada jurnal pada periode ini.</EmptyRow>}
              {rows.map((r) => (
                <tr key={r.noRef} className="hover:bg-surface-2/60">
                  <td className={`${td} whitespace-nowrap text-ink-2`}>{formatTanggal(r.tanggal)}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    <Link href={`${base}/${r.noRef}`} className="font-medium text-accent-ink hover:underline">
                      {r.tcode || `#${r.noRef}`}
                    </Link>
                  </td>
                  <td className={td}>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.jenis === "EOM" ? "bg-warn-bg text-warn-ink" : "bg-surface-2 text-ink-2"}`}>
                      {r.jenis === "EOM" ? "Tutup bulan" : r.jenis || "-"}
                    </span>
                  </td>
                  <td className={td}>{r.keterangan || <span className="text-muted">-</span>}</td>
                  <td className={angka}>{formatRupiah(r.total)}</td>
                  <td className={`${td} text-right text-ink-2`}>{r.fotoCount ? `📷 ${r.fotoCount}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
