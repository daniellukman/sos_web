import type { Metadata } from "next";
import Link from "next/link";
import { EmptyRow, PageHeader, td, th } from "@/components/ui";
import { formatRupiah } from "@/lib/format";
import { getGlTahun, getNeracaSaldo, labelPeriode, parseGlPeriode, periodeQuery } from "@/lib/gl";
import { bukuBesarPath, getGlContext } from "@/lib/gl-context";
import { NamaAkun, angka, rowCls } from "../akun-cell";
import PeriodeForm from "../periode-form";

export const metadata: Metadata = { title: "GL — Neraca Saldo" };

export default async function NeracaSaldoPage({ params, searchParams }: PageProps<"/gl/[perusahaan]/neraca-saldo">) {
  const { perusahaan } = await params;
  await getGlContext(perusahaan);
  const sp = await searchParams;
  const tahunList = await getGlTahun(perusahaan);
  const periode = parseGlPeriode((k) => sp[k], tahunList);
  const rows = await getNeracaSaldo(perusahaan, periode);
  const q = periodeQuery(periode);

  // Akun induk sudah berisi total anak-anaknya, jadi tidak ikut dijumlah
  const detail = rows.filter((r) => !r.induk);
  const sum = (f: (r: (typeof rows)[number]) => number) => detail.reduce((s, r) => s + f(r), 0);
  const total = { saldoAwal: sum((r) => r.saldoAwal), debet: sum((r) => r.debet), kredit: sum((r) => r.kredit), saldoAkhir: sum((r) => r.saldoAkhir) };
  const seimbang = Math.abs(total.debet - total.kredit) < 1;

  return (
    <>
      <PageHeader title="Neraca Saldo" description={`Saldo per akun ${labelPeriode(periode)} · dari hasil posting (GLBalnc)`}>
        {/* Link biasa (bukan <Link>) agar browser langsung mengunduh file */}
        <a href={`/api/gl-export/${encodeURIComponent(perusahaan)}/neraca-saldo?${q}`} className="btn-ghost" download>
          ⬇ Export ke Excel
        </a>
      </PageHeader>

      <PeriodeForm periode={periode} tahunList={tahunList} />

      <div className="card overflow-hidden">
        <div className="flex flex-wrap gap-x-6 gap-y-1 px-5 py-3 text-sm text-ink-2">
          <span>{detail.length} akun</span>
          <span>
            Mutasi debet <b className="tabular text-ink">{formatRupiah(total.debet)}</b>
          </span>
          <span>
            Mutasi kredit <b className="tabular text-ink">{formatRupiah(total.kredit)}</b>
          </span>
          {!seimbang && <span className="font-medium text-danger">Debet dan kredit tidak seimbang</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-y border-line bg-surface-2/50">
              <tr>
                <th className={th}>Akun</th>
                <th className={th}>Nama</th>
                <th className={`${th} text-right`}>Saldo Awal</th>
                <th className={`${th} text-right`}>Debet</th>
                <th className={`${th} text-right`}>Kredit</th>
                <th className={`${th} text-right`}>Saldo Akhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && <EmptyRow colSpan={6}>Belum ada saldo untuk periode ini.</EmptyRow>}
              {rows.map((r) => (
                <tr key={r.akun} className={rowCls(r.induk)}>
                  <td className={`${td} whitespace-nowrap`}>
                    <Link href={bukuBesarPath(perusahaan, r.akun, periode)} className="font-medium text-accent-ink hover:underline">
                      {r.akun}
                    </Link>
                  </td>
                  <NamaAkun nama={r.nama} level={r.level} />
                  <td className={angka}>{formatRupiah(r.saldoAwal)}</td>
                  <td className={angka}>{formatRupiah(r.debet)}</td>
                  <td className={angka}>{formatRupiah(r.kredit)}</td>
                  <td className={angka}>{formatRupiah(r.saldoAkhir)}</td>
                </tr>
              ))}
            </tbody>
            {rows.length > 0 && (
              <tfoot className="border-t-2 border-line font-semibold">
                <tr>
                  <td className={td} colSpan={2}>
                    Total
                  </td>
                  <td className={angka}>{formatRupiah(total.saldoAwal)}</td>
                  <td className={angka}>{formatRupiah(total.debet)}</td>
                  <td className={angka}>{formatRupiah(total.kredit)}</td>
                  <td className={angka}>{formatRupiah(total.saldoAkhir)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </>
  );
}
