import type { Metadata } from "next";
import { EmptyRow, PageHeader, td, th } from "@/components/ui";
import { NAMA_BULAN } from "@/lib/gl";
import { getGlContext } from "@/lib/gl-context";
import { getSetupPeriode } from "@/lib/gl-periode";
import AktifCheckbox from "./aktif-checkbox";
import TambahForm from "./tambah-form";

export const metadata: Metadata = { title: "GL — Setup Periode" };

export default async function SetupPeriodePage({ params, searchParams }: PageProps<"/gl/[perusahaan]/setup-periode">) {
  const { perusahaan } = await params;
  await getGlContext(perusahaan);
  const sp = await searchParams;
  const rows = await getSetupPeriode(perusahaan);
  const added = Number(typeof sp.added === "string" ? sp.added : 0);

  const now = new Date();
  const tahunIni = now.getFullYear();
  // Pilihan tahun: dari periode tertua yang ada sampai tahun depan
  const tahunMin = Math.min(tahunIni - 1, ...rows.map((r) => r.tahun));
  const tahunList = Array.from({ length: tahunIni + 1 - tahunMin + 1 }, (_, i) => tahunIni + 1 - i);
  // Default: bulan setelah periode terbaru
  const terbaru = rows.at(-1);
  const next = terbaru ? (terbaru.bulan === 12 ? { tahun: terbaru.tahun + 1, bulan: 1 } : { tahun: terbaru.tahun, bulan: terbaru.bulan + 1 }) : { tahun: tahunIni, bulan: now.getMonth() + 1 };
  const aktif = rows.filter((r) => r.active).length;

  return (
    <>
      <PageHeader title="Setup Periode" description="Centang = aktif: jurnal bulan itu boleh diinput, diubah, dan dihapus. Tanpa centang: hanya bisa dilihat. Perubahan langsung tersimpan." />

      {added > 0 && (
        <p role="status" className="mb-4 rounded-lg bg-good-bg px-4 py-3 text-sm text-good">
          ✓ {added} periode ditambahkan.
        </p>
      )}

      <TambahForm perusahaan={perusahaan} namaBulan={NAMA_BULAN} tahunList={tahunList} tahunDefault={Math.min(next.tahun, tahunIni + 1)} bulanDefault={next.bulan} />

      <div className="card overflow-hidden">
        <div className="px-5 py-3 text-sm text-ink-2">
          {rows.length} periode · {aktif} aktif · {rows.length - aktif} tidak aktif
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-y border-line bg-surface-2/50">
              <tr>
                <th className={th}>Periode</th>
                <th className={`${th} w-24 text-center`}>Aktif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && <EmptyRow colSpan={2}>Belum ada periode. Tambahkan di atas.</EmptyRow>}
              {rows.map((r) => (
                <tr key={r.periode} className="hover:bg-surface-2/60">
                  <td className={`${td} font-medium whitespace-nowrap`}>
                    {NAMA_BULAN[r.bulan - 1]} {r.tahun}
                  </td>
                  <td className={`${td} text-center`}>
                    <AktifCheckbox perusahaan={perusahaan} tahun={r.tahun} bulan={r.bulan} label={`${NAMA_BULAN[r.bulan - 1]} ${r.tahun}`} active={r.active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
