import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { EmptyRow, PageHeader, td, th } from "@/components/ui";
import { formatRupiah } from "@/lib/format";
import { NAMA_BULAN, getGlTahun, getNeraca, parseGlBulan, type NeracaSisiRow } from "@/lib/gl";
import { bukuBesarPath, getGlContext } from "@/lib/gl-context";
import { NamaAkun, angka, rowCls } from "../akun-cell";
import PeriodeForm from "../periode-form";

export const metadata: Metadata = { title: "GL — Neraca" };

type SisiProps = { judul: string; rows: NeracaSisiRow[]; total: number; akunHref: (akun: string) => string; ekstra?: ReactNode };

function Sisi({ judul, rows, total, akunHref, ekstra }: SisiProps) {
  return (
    <div className="card overflow-hidden">
      <h2 className="border-b border-line px-5 py-3 font-medium">{judul}</h2>
      <table className="w-full">
        <thead className="border-b border-line bg-surface-2/50">
          <tr>
            <th className={th}>Akun</th>
            <th className={th}>Nama</th>
            <th className={`${th} text-right`}>Saldo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.length === 0 && !ekstra && <EmptyRow colSpan={3}>Tidak ada saldo.</EmptyRow>}
          {rows.map((r) => (
            <tr key={r.akun} className={rowCls(r.induk)}>
              <td className={`${td} whitespace-nowrap`}>
                <Link href={akunHref(r.akun)} className="font-medium text-accent-ink hover:underline">
                  {r.akun}
                </Link>
              </td>
              <NamaAkun nama={r.nama} level={r.level} />
              <td className={angka}>{formatRupiah(r.saldo)}</td>
            </tr>
          ))}
          {ekstra}
        </tbody>
        <tfoot className="border-t-2 border-line font-semibold">
          <tr>
            <td className={td} colSpan={2}>
              Total {judul.toLowerCase()}
            </td>
            <td className={angka}>{formatRupiah(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default async function NeracaPage({ params, searchParams }: PageProps<"/gl/[perusahaan]/neraca">) {
  const { perusahaan } = await params;
  await getGlContext(perusahaan);
  const sp = await searchParams;
  const tahunList = await getGlTahun(perusahaan);
  const periode = parseGlBulan((k) => sp[k], tahunList);
  const n = await getNeraca(perusahaan, periode);
  const seimbang = Math.abs(n.totalAktiva - n.totalPasiva) < 1;
  const akunHref = (akun: string) => bukuBesarPath(perusahaan, akun, { ...periode, dari: 1 });

  return (
    <>
      <PageHeader title="Neraca" description={`Posisi keuangan per akhir ${NAMA_BULAN[periode.sampai - 1]} ${periode.tahun}`}>
        <div className="flex flex-wrap items-center gap-2">
          {!seimbang && <span className="rounded-lg bg-danger-bg px-3 py-1.5 text-sm font-medium text-danger">Aktiva dan pasiva tidak seimbang</span>}
          {/* Link biasa (bukan <Link>) agar browser langsung mengunduh file */}
          <a href={`/api/gl-export/${encodeURIComponent(perusahaan)}/neraca?tahun=${periode.tahun}&bulan=${periode.sampai}`} className="btn-ghost" download>
            ⬇ Export ke Excel
          </a>
        </div>
      </PageHeader>

      <PeriodeForm periode={periode} tahunList={tahunList} mode="bulan" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Sisi judul="Aktiva" rows={n.aktiva} total={n.totalAktiva} akunHref={akunHref} />
        <Sisi
          judul="Pasiva"
          rows={n.pasiva}
          total={n.totalPasiva}
          akunHref={akunHref}
          ekstra={
            n.labaBerjalan !== 0 && (
              <tr className="bg-surface-2/40 italic">
                <td className={td} colSpan={2}>
                  Laba (rugi) berjalan — belum tutup bulan
                </td>
                <td className={angka}>{formatRupiah(n.labaBerjalan)}</td>
              </tr>
            )
          }
        />
      </div>
    </>
  );
}
