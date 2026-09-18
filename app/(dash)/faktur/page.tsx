import type { Metadata } from "next";
import Link from "next/link";
import StatusBayarBadge from "@/components/status-bayar";
import { EmptyRow, PageHeader, td, th } from "@/components/ui";
import { getContext } from "@/lib/context";
import { getFakturList, parseFakturFilter } from "@/lib/faktur";
import { formatRupiah, formatTanggal } from "@/lib/format";

export const metadata: Metadata = { title: "Daftar Invoice" };

export default async function FakturListPage({ searchParams }: PageProps<"/faktur">) {
  await getContext();
  const sp = await searchParams;
  const filter = parseFakturFilter((k) => sp[k]);
  const { q, dari, sampai, status } = filter;

  const rows = await getFakturList(filter);
  const exportQuery = new URLSearchParams(Object.entries(filter).filter(([, v]) => v)).toString();
  const total = rows.reduce((s, f) => s + f.nilaiAkhir, 0);
  const sisa = rows.reduce((s, f) => s + (f.status === "lunas" ? 0 : f.nilaiAkhir - f.nilaiDibayar), 0);

  return (
    <>
      <PageHeader title="Daftar Invoice" description="Invoice PT. SOS yang sudah diterbitkan">
        <div className="flex flex-wrap gap-2">
          <Link href="/invoice" className="btn-ghost">
            Outstanding invoice →
          </Link>
          {/* Link biasa (bukan <Link>) agar browser langsung mengunduh file */}
          <a href={`/api/faktur-export${exportQuery ? `?${exportQuery}` : ""}`} className="btn" download>
            ⬇ Export ke Excel
          </a>
        </div>
      </PageHeader>

      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto]">
        <input name="q" defaultValue={q} placeholder="Cari no. faktur, customer, no. kontrak…" className="input" />
        <input name="dari" type="date" defaultValue={dari} className="input" aria-label="Dari tanggal" />
        <input name="sampai" type="date" defaultValue={sampai} className="input" aria-label="Sampai tanggal" />
        <select name="status" defaultValue={status} className="input" aria-label="Status pembayaran">
          <option value="">Semua status</option>
          <option value="belum">Belum dibayar</option>
          <option value="sebagian">Dibayar sebagian</option>
          <option value="lunas">Lunas</option>
        </select>
        <div className="flex gap-2">
          <button className="btn flex-1">Filter</button>
          <Link href="/faktur" className="btn-ghost">
            Reset
          </Link>
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap gap-x-6 gap-y-1 px-5 py-3 text-sm text-ink-2">
          <span>{rows.length} invoice</span>
          <span>
            Total <b className="tabular text-ink">{formatRupiah(total)}</b>
          </span>
          <span>
            Belum terbayar <b className="tabular text-ink">{formatRupiah(sisa)}</b>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-y border-line bg-surface-2/50">
              <tr>
                <th className={th}>No. Faktur</th>
                <th className={th}>Tanggal</th>
                <th className={th}>Customer</th>
                <th className={th}>No. Kontrak</th>
                <th className={`${th} text-right`}>Nilai Akhir</th>
                <th className={th}>Status</th>
                <th className={th}>
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && <EmptyRow colSpan={7}>Tidak ada invoice.</EmptyRow>}
              {rows.map((f) => (
                <tr key={f.noRef} className="hover:bg-surface-2/60">
                  <td className={td}>
                    <Link href={`/faktur/${f.noRef}`} className="font-medium whitespace-nowrap text-accent-ink hover:underline">
                      {f.noFaktur || `#${f.noRef}`}
                    </Link>
                  </td>
                  <td className={`${td} whitespace-nowrap text-ink-2`}>{formatTanggal(f.tanggal)}</td>
                  <td className={td}>
                    <div>{f.customerNama ?? "-"}</div>
                    {f.customer && <div className="text-xs text-muted">{f.customer}</div>}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{f.noKontrak || <span className="text-muted">-</span>}</td>
                  <td className={`${td} tabular text-right whitespace-nowrap`}>{formatRupiah(f.nilaiAkhir)}</td>
                  <td className={td}>
                    <StatusBayarBadge status={f.status} />
                  </td>
                  <td className={`${td} text-right whitespace-nowrap`}>
                    <Link href={`/faktur/${f.noRef}`} className="rounded-md px-2 py-1 text-accent-ink hover:bg-surface-2">
                      Lihat
                    </Link>
                    <a
                      href={`/cetak/faktur/${f.noRef}`}
                      target="_blank"
                      rel="noopener"
                      className="rounded-md px-2 py-1 text-accent-ink hover:bg-surface-2"
                    >
                      Cetak
                    </a>
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
