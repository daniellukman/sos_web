import Link from "next/link";
import { NAMA_BULAN, type GlPeriode } from "@/lib/gl";

const BulanOptions = () =>
  NAMA_BULAN.map((nama, i) => (
    <option key={nama} value={i + 1}>
      {nama}
    </option>
  ));

type Props = {
  periode: GlPeriode;
  tahunList: number[];
  /** Jika diisi, tampilkan tombol Reset yang kembali ke periode default */
  resetHref?: string;
  /** "rentang" = bulan dari–sampai, "bulan" = satu bulan (neraca) */
  mode?: "rentang" | "bulan";
  /** Kolom tambahan di kiri tombol (mis. kotak pencarian) */
  extra?: React.ReactNode;
  /** Kolom di paling depan, sebelum tahun (mis. pilihan akun) */
  lead?: React.ReactNode;
  /** Teks di depan pilihan bulan pada mode "bulan" (mis. "s/d bulan") */
  labelBulan?: string;
};

/** Filter tahun + bulan, dipakai semua laporan GL. */
export default function PeriodeForm({ periode, tahunList, resetHref, mode = "rentang", extra, lead, labelBulan }: Props) {
  return (
    <form className="card mb-4 flex flex-wrap items-center gap-3 p-4">
      {lead}
      <select name="tahun" defaultValue={periode.tahun} className="input w-28" aria-label="Tahun">
        {tahunList.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      {mode === "bulan" ? (
        <>
          {labelBulan && <span className="text-sm text-muted">{labelBulan}</span>}
          <select name="bulan" defaultValue={periode.sampai} className="input w-28" aria-label={labelBulan ?? "Bulan"}>
            <BulanOptions />
          </select>
        </>
      ) : (
        <>
          <select name="dari" defaultValue={periode.dari} className="input w-28" aria-label="Dari bulan">
            <BulanOptions />
          </select>
          <span className="text-sm text-muted">s/d</span>
          <select name="sampai" defaultValue={periode.sampai} className="input w-28" aria-label="Sampai bulan">
            <BulanOptions />
          </select>
        </>
      )}
      {extra}
      <div className="flex gap-2">
        <button className="btn">Tampilkan</button>
        {resetHref && (
          <Link href={resetHref} className="btn-ghost">
            Reset
          </Link>
        )}
      </div>
    </form>
  );
}
