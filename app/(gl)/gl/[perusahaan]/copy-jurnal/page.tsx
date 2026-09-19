import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { NAMA_BULAN, getAkunTransaksi, getGlTahun, getInfoCopy, getJurnalList, labelPeriode, parseGlBulan } from "@/lib/gl";
import { getGlContext, glPath, otherCompanies } from "@/lib/gl-context";
import { JENIS_INPUT } from "@/lib/gl-jurnal";
import CopyForm from "./copy-form";

export const metadata: Metadata = { title: "GL — Copy Jurnal" };

export default async function CopyJurnalPage({ params, searchParams }: PageProps<"/gl/[perusahaan]/copy-jurnal">) {
  const { perusahaan } = await params;
  const { companies } = await getGlContext(perusahaan);
  const sp = await searchParams;
  const lain = otherCompanies(companies, perusahaan);
  const sumber = lain.find((c) => c.kode === sp.sumber) ?? lain[0];

  if (!sumber) {
    return (
      <>
        <PageHeader title="Copy Jurnal" />
        <div className="card px-5 py-10 text-center text-sm text-muted">Anda hanya terdaftar untuk satu perusahaan, tidak ada sumber untuk dicopy.</div>
      </>
    );
  }

  const tahunList = await getGlTahun(sumber.kode);
  const periode = parseGlBulan((k) => sp[k], tahunList);
  const [semua, info, akunTujuan] = await Promise.all([getJurnalList(sumber.kode, periode, ""), getInfoCopy(sumber.kode, periode), getAkunTransaksi(perusahaan)]);
  // Hanya jurnal input; jurnal tutup bulan (EOM) tidak disalin
  const semuaRows = semua.filter((r) => r.jenis === JENIS_INPUT).map((r) => ({ ...r, ...(info.get(r.noRef) ?? { akunBiaya: "", namaBiaya: "", foto: null }) }));

  // Filter account biaya: pilihan diambil dari account biaya yang muncul di jurnal bulan ini. "-" = jurnal tanpa account biaya.
  const pilihanBiaya = [...new Map(semuaRows.filter((r) => r.akunBiaya).map((r) => [r.akunBiaya, r.namaBiaya])).entries()].sort(([a], [b]) => a.localeCompare(b));
  const adaTanpaBiaya = semuaRows.some((r) => !r.akunBiaya);
  const biaya = typeof sp.biaya === "string" && (sp.biaya === "-" || pilihanBiaya.some(([a]) => a === sp.biaya)) ? sp.biaya : "";
  const rows = biaya ? semuaRows.filter((r) => (biaya === "-" ? !r.akunBiaya : r.akunBiaya === biaya)) : semuaRows;

  return (
    <>
      <PageHeader title="Copy Jurnal" description={`Salin jurnal beserta fotonya dari perusahaan lain ke ${perusahaan}. Nomor jurnal dibuat ulang sesuai ${perusahaan}.`} />

      <form className="card mb-4 flex flex-wrap items-center gap-3 p-4">
        <label className="text-sm text-ink-2" htmlFor="sumber">
          Dari
        </label>
        <select id="sumber" name="sumber" defaultValue={sumber.kode} className="input w-56">
          {lain.map((c) => (
            <option key={c.kode} value={c.kode}>
              {c.kode} · {c.nama}
            </option>
          ))}
        </select>
        <select name="tahun" defaultValue={periode.tahun} className="input w-28" aria-label="Tahun">
          {tahunList.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select name="bulan" defaultValue={periode.sampai} className="input w-28" aria-label="Bulan">
          {NAMA_BULAN.map((nama, i) => (
            <option key={nama} value={i + 1}>
              {nama}
            </option>
          ))}
        </select>
        <select name="biaya" defaultValue={biaya} className="input w-64" aria-label="Account biaya">
          <option value="">Semua account biaya</option>
          {pilihanBiaya.map(([akun, nama]) => (
            <option key={akun} value={akun}>
              {akun} · {nama || "-"}
            </option>
          ))}
          {adaTanpaBiaya && <option value="-">Tanpa account biaya</option>}
        </select>
        <button className="btn">Tampilkan</button>
        <span className="text-sm text-muted">{labelPeriode(periode)}</span>
      </form>

      <CopyForm key={`${sumber.kode}-${periode.tahun}-${periode.sampai}-${biaya}`} tujuan={perusahaan} sumber={sumber.kode} rows={rows} akunTujuan={akunTujuan} />

      <p className="mt-3 text-xs text-muted">
        Jurnal disalin ke bulan yang sama; bulan tersebut harus aktif di {perusahaan}. Kode akun yang tidak ada di {perusahaan} akan diminta penggantinya. Lihat hasilnya di{" "}
        <a href={glPath(perusahaan, "/jurnal")} className="text-accent-ink hover:underline">
          daftar jurnal
        </a>
        .
      </p>
    </>
  );
}
