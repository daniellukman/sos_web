import type { Metadata } from "next";
import Link from "next/link";
import { EmptyRow, PageHeader, td, th } from "@/components/ui";
import { formatRupiah } from "@/lib/format";
import { NAMA_BULAN, getGlTahun, getRugiLaba, labelPeriode, parseGlBulan } from "@/lib/gl";
import { bukuBesarPath, getGlContext } from "@/lib/gl-context";
import { NamaAkun, angka, rowCls } from "../akun-cell";
import PeriodeForm from "../periode-form";

export const metadata: Metadata = { title: "GL — Rugi Laba" };

const Laba = ({ n }: { n: number }) => <span className={n < 0 ? "text-danger" : ""}>{formatRupiah(n)}</span>;

export default async function RugiLabaPage({ params, searchParams }: PageProps<"/gl/[perusahaan]/rugi-laba">) {
  const { perusahaan } = await params;
  await getGlContext(perusahaan);
  const sp = await searchParams;
  const tahunList = await getGlTahun(perusahaan);
  // Nilai = bulan yang dipilih, Nilai YTD = Januari s/d bulan itu
  const periode = parseGlBulan((k) => sp[k], tahunList);
  const { rows, totalPeriode, totalTahunBerjalan } = await getRugiLaba(perusahaan, periode);
  const ytd = `Jan – ${NAMA_BULAN[periode.sampai - 1]} ${periode.tahun}`;

  return (
    <>
      <PageHeader title="Rugi Laba" description={`Laporan laba rugi s/d ${labelPeriode(periode)}`}>
        {/* Link biasa (bukan <Link>) agar browser langsung mengunduh file */}
        <a href={`/api/gl-export/${encodeURIComponent(perusahaan)}/rugi-laba?tahun=${periode.tahun}&bulan=${periode.sampai}`} className="btn-ghost" download>
          ⬇ Export ke Excel
        </a>
      </PageHeader>

      <PeriodeForm periode={periode} tahunList={tahunList} mode="bulan" labelBulan="s/d bulan" />

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-y border-line bg-surface-2/50">
              <tr>
                <th className={th}>Account</th>
                <th className={th}>Nama Account</th>
                <th className={`${th} text-right`} title={labelPeriode(periode)}>
                  Nilai
                </th>
                <th className={`${th} text-right`} title={ytd}>
                  Nilai YTD
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && <EmptyRow colSpan={4}>Belum ada data rugi laba untuk periode ini.</EmptyRow>}
              {rows.map((r) => (
                <tr key={r.akun} className={rowCls(r.induk)}>
                  <td className={`${td} whitespace-nowrap`}>
                    <Link href={bukuBesarPath(perusahaan, r.akun, { ...periode, dari: 1 })} className="font-medium text-accent-ink hover:underline">
                      {r.akun}
                    </Link>
                  </td>
                  <NamaAkun nama={r.nama} level={r.level} />
                  <td className={angka}>
                    <Laba n={r.periode} />
                  </td>
                  <td className={angka}>
                    <Laba n={r.tahunBerjalan} />
                  </td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="border-t-2 border-line font-semibold">
                <tr>
                  <td className={td} colSpan={2}>
                    {totalTahunBerjalan < 0 ? "Rugi bersih" : "Laba bersih"}
                  </td>
                  <td className={angka}>
                    <Laba n={totalPeriode} />
                  </td>
                  <td className={angka}>
                    <Laba n={totalTahunBerjalan} />
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  );
}
