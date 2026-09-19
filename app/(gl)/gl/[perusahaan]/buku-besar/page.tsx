import type { Metadata } from "next";
import Link from "next/link";
import { EmptyRow, PageHeader, td, th } from "@/components/ui";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { NAMA_BULAN, bukuBesarQuery, getBukuBesarRentang, getDaftarAkun, getGlTahun, labelBukuBesar, parseBukuBesarFilter, type DaftarAkun } from "@/lib/gl";
import { getGlContext, glPath } from "@/lib/gl-context";
import { angka } from "../akun-cell";

export const metadata: Metadata = { title: "GL — Buku Besar" };

const BulanOptions = () =>
  NAMA_BULAN.map((nama, i) => (
    <option key={nama} value={i + 1}>
      {nama}
    </option>
  ));

function AkunSelect({ name, value, label, pilihan }: { name: string; value: string; label: string; pilihan: DaftarAkun[] }) {
  return (
    <select name={name} defaultValue={value} className="input w-full sm:w-72" aria-label={label} required>
      <option value="">— {label} —</option>
      {pilihan.map((a) => (
        <option key={a.akun} value={a.akun}>
          {a.akun} · {a.nama}
        </option>
      ))}
    </select>
  );
}

function BulanTahun({ prefix, bulan, tahun, tahunList }: { prefix: "Dari" | "Sampai"; bulan: number; tahun: number; tahunList: number[] }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 text-sm text-ink-2">{prefix}</span>
      <select name={`bulan${prefix}`} defaultValue={bulan} className="input w-28" aria-label={`${prefix} bulan`}>
        <BulanOptions />
      </select>
      <select name={`tahun${prefix}`} defaultValue={tahun} className="input w-28" aria-label={`${prefix} tahun`}>
        {tahunList.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
    </div>
  );
}

export default async function BukuBesarPage({ params, searchParams }: PageProps<"/gl/[perusahaan]/buku-besar">) {
  const { perusahaan } = await params;
  await getGlContext(perusahaan);
  const sp = await searchParams;
  const [tahunList, daftarAkun] = await Promise.all([getGlTahun(perusahaan), getDaftarAkun(perusahaan)]);
  const f = parseBukuBesarFilter((k) => sp[k], tahunList);
  // Akun induk tidak dipilih di sini: sub-akunnya sudah tampil masing-masing
  const pilihan = daftarAkun.filter((a) => !a.induk);
  const siap = Boolean(f.akunDari && f.akunSampai);
  const akunList = siap ? await getBukuBesarRentang(perusahaan, f) : [];
  const totalSaldoAwal = akunList.reduce((s, a) => s + a.saldoAwal, 0);
  const totalDebet = akunList.reduce((s, a) => s + a.debet, 0);
  const totalKredit = akunList.reduce((s, a) => s + a.kredit, 0);

  return (
    <>
      <PageHeader title="Buku Besar" description={siap ? `Akun ${f.akunDari}${f.akunSampai !== f.akunDari ? ` – ${f.akunSampai}` : ""} · ${labelBukuBesar(f)}` : "Pilih rentang akun dan periode"}>
        {siap && (
          // Link biasa (bukan <Link>) agar browser langsung mengunduh file
          <a href={`/api/gl-export/${encodeURIComponent(perusahaan)}/buku-besar?${bukuBesarQuery(f)}`} className="btn-ghost" download>
            ⬇ Export ke Excel
          </a>
        )}
      </PageHeader>

      <form className="card mb-4 grid gap-3 p-4 lg:grid-cols-[auto_1fr_auto]">
        <div className="grid gap-3 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-[auto_1fr_auto_1fr]">
          <span className="self-center text-sm text-ink-2">Dari Account</span>
          <AkunSelect name="akunDari" value={f.akunDari} label="Dari Account" pilihan={pilihan} />
          <span className="self-center text-sm text-ink-2">Sampai Account</span>
          <AkunSelect name="akunSampai" value={f.akunSampai} label="Sampai Account" pilihan={pilihan} />
        </div>
        <div className="flex flex-wrap gap-3 lg:col-span-2">
          <BulanTahun prefix="Dari" bulan={f.bulanDari} tahun={f.tahunDari} tahunList={tahunList} />
          <BulanTahun prefix="Sampai" bulan={f.bulanSampai} tahun={f.tahunSampai} tahunList={tahunList} />
        </div>
        <div className="lg:col-start-3 lg:row-span-2 lg:row-start-1 lg:self-end">
          <button className="btn">Tampilkan</button>
        </div>
      </form>

      {siap && (
        <>
          <div className="card mb-4 flex flex-wrap gap-x-6 gap-y-1 px-5 py-3 text-sm text-ink-2">
            <span>{akunList.length} akun</span>
            <span>
              Total saldo awal <b className="tabular text-ink">{formatRupiah(totalSaldoAwal)}</b>
            </span>
            <span>
              Total debet <b className="tabular text-ink">{formatRupiah(totalDebet)}</b>
            </span>
            <span>
              Total kredit <b className="tabular text-ink">{formatRupiah(totalKredit)}</b>
            </span>
          </div>

          {akunList.length === 0 && <div className="card px-5 py-10 text-center text-sm text-muted">Tidak ada saldo maupun transaksi pada rentang ini.</div>}

          {akunList.map((a) => (
            <div key={a.akun} className="card mb-4 overflow-hidden">
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3">
                <h2 className="font-medium">
                  {a.akun} · {a.nama}
                </h2>
                <span className="text-sm text-ink-2">
                  {a.rows.length} transaksi · Saldo akhir <b className="tabular text-ink">{formatRupiah(a.saldoAkhir)}</b>
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-y border-line bg-surface-2/50">
                    <tr>
                      <th className={th}>Tanggal</th>
                      <th className={th}>No. Jurnal</th>
                      <th className={th}>Keterangan</th>
                      <th className={`${th} text-right`}>Debet</th>
                      <th className={`${th} text-right`}>Kredit</th>
                      <th className={`${th} text-right`}>Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    <tr className="bg-surface-2/40">
                      <td className={`${td} text-ink-2`} colSpan={5}>
                        Saldo awal
                      </td>
                      <td className={`${angka} font-medium`}>{formatRupiah(a.saldoAwal)}</td>
                    </tr>
                    {a.rows.length === 0 && <EmptyRow colSpan={6}>Tidak ada transaksi pada periode ini.</EmptyRow>}
                    {a.rows.map((r, i) => (
                      <tr key={`${r.noRef}-${i}`} className="hover:bg-surface-2/60">
                        <td className={`${td} whitespace-nowrap text-ink-2`}>{formatTanggal(r.tanggal)}</td>
                        <td className={`${td} whitespace-nowrap`}>
                          <Link href={glPath(perusahaan, `/jurnal/${r.noRef}`)} className="font-medium text-accent-ink hover:underline">
                            {r.tcode || `#${r.noRef}`}
                          </Link>
                        </td>
                        <td className={td}>{r.keterangan || <span className="text-muted">-</span>}</td>
                        <td className={angka}>{r.debet ? formatRupiah(r.debet) : ""}</td>
                        <td className={angka}>{r.kredit ? formatRupiah(r.kredit) : ""}</td>
                        <td className={angka}>{formatRupiah(r.saldo)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-line font-semibold">
                    <tr>
                      <td className={td} colSpan={2}>
                        Total {a.akun}
                      </td>
                      <td className={`${td} whitespace-nowrap`}>
                        Saldo awal <span className="tabular">{formatRupiah(a.saldoAwal)}</span>
                      </td>
                      <td className={angka}>{formatRupiah(a.debet)}</td>
                      <td className={angka}>{formatRupiah(a.kredit)}</td>
                      <td className={angka}>{formatRupiah(a.saldoAkhir)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );
}
