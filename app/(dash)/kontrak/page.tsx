import type { Metadata } from "next";
import Link from "next/link";
import { EmptyRow, PageHeader, td, th } from "@/components/ui";
import { getContext } from "@/lib/context";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { getKontrakList, parseKontrakFilter, type KontrakRow } from "@/lib/kontrak";

export const metadata: Metadata = { title: "Kontrak" };

function Penagihan({ k }: { k: KontrakRow }) {
  if (!k.recurring) return <span className="text-ink-2">1 kali</span>;
  const n = k.periodeValue ?? 1;
  const unit = k.periode === "TAHUN" ? "tahun" : "bulan";
  return <span>{n === 1 ? `Tiap ${unit}` : `Tiap ${n} ${unit}`}</span>;
}

function Status({ k }: { k: KontrakRow }) {
  if (!k.recurring) return <span className="text-muted">-</span>;
  return k.selesai === 1 ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-2">
      <span aria-hidden>■</span> Selesai
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-good-bg px-2 py-0.5 text-xs font-medium text-good">
      <span aria-hidden>●</span> Berjalan
    </span>
  );
}

export default async function KontrakPage({ searchParams }: PageProps<"/kontrak">) {
  await getContext();
  const sp = await searchParams;
  const filter = parseKontrakFilter((k) => sp[k]);
  const { q, status } = filter;
  const rows = await getKontrakList(filter);
  const exportQuery = new URLSearchParams(Object.entries(filter).filter(([, v]) => v)).toString();

  return (
    <>
      <PageHeader title="Kontrak" description="Kontrak customer dan jadwal penagihannya">
        <div className="flex flex-wrap gap-2">
          {/* Link biasa (bukan <Link>) agar browser langsung mengunduh file */}
          <a href={`/api/kontrak-export${exportQuery ? `?${exportQuery}` : ""}`} className="btn-ghost" download>
            ⬇ Export ke Excel
          </a>
          <Link href="/kontrak/baru" className="btn">
            + Tambah kontrak
          </Link>
        </div>
      </PageHeader>

      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_200px_auto]">
        <input name="q" defaultValue={q} placeholder="Cari no. kontrak, customer, deskripsi…" className="input" />
        <select name="status" defaultValue={status} className="input" aria-label="Status">
          <option value="">Semua kontrak</option>
          <option value="berjalan">Berulang — berjalan</option>
          <option value="selesai">Berulang — selesai</option>
          <option value="sekali">Invoice 1 kali</option>
        </select>
        <div className="flex gap-2">
          <button className="btn flex-1">Filter</button>
          <Link href="/kontrak" className="btn-ghost">
            Reset
          </Link>
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-surface-2/50">
              <tr>
                <th className={th}>No. Kontrak</th>
                <th className={th}>Tanggal</th>
                <th className={th}>Customer</th>
                <th className={th}>Bidang Usaha</th>
                <th className={`${th} text-right`}>Nilai Invoice</th>
                <th className={th}>Penagihan</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && (
                <EmptyRow colSpan={7}>{q || status ? "Tidak ada kontrak yang cocok." : "Belum ada kontrak."}</EmptyRow>
              )}
              {rows.map((k) => (
                <tr key={k.noRef} className="hover:bg-surface-2/60">
                  <td className={td}>
                    <Link href={`/kontrak/${k.noRef}`} className="font-medium text-accent-ink hover:underline">
                      {k.noKontrak || `#${k.noRef}`}
                    </Link>
                  </td>
                  <td className={`${td} whitespace-nowrap text-ink-2`}>{formatTanggal(k.tanggal)}</td>
                  <td className={td}>
                    <div>{k.customerNama ?? "-"}</div>
                    {k.customer && <div className="text-xs text-muted">{k.customer}</div>}
                  </td>
                  <td className={td}>{k.lobNama ?? "-"}</td>
                  <td className={`${td} tabular text-right whitespace-nowrap`}>{formatRupiah(k.nilaiInvoice)}</td>
                  <td className={`${td} whitespace-nowrap`}>
                    <Penagihan k={k} />
                  </td>
                  <td className={td}>
                    <Status k={k} />
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
