import type { Metadata } from "next";
import Link from "next/link";
import { EmptyRow, PageHeader, td, th } from "@/components/ui";
import { getContext } from "@/lib/context";
import { formatRupiah, formatTanggal } from "@/lib/format";
import { getOutstanding } from "@/lib/invoice";
import { labelJadwal, labelPeriode } from "@/lib/invoice-text";

export const metadata: Metadata = { title: "Outstanding Invoice" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export default async function OutstandingInvoicePage({ searchParams }: PageProps<"/invoice">) {
  await getContext();
  const sp = await searchParams;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  const sampai = isDate(str(sp.sampai)) ? str(sp.sampai) : today;
  const q = str(sp.q).trim().toLowerCase();
  const saved = str(sp.saved);

  const rows = (await getOutstanding(sampai)).filter(
    ({ kontrak: k }) =>
      !q || [k.noKontrak, k.customer, k.customerNama, k.lobNama].some((v) => v?.toLowerCase().includes(q)),
  );
  const total = rows.reduce((s, r) => s + r.kontrak.nilaiInvoice, 0);

  return (
    <>
      <PageHeader title="Outstanding Invoice" description="Tagihan kontrak yang sudah jatuh tempo dan belum dibuatkan invoice" />

      {saved && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-lg bg-good-bg px-4 py-3 text-sm text-good">
          <span aria-hidden>✓</span> Invoice <b>{saved}</b> berhasil dibuat.
          {Number(str(sp.ref)) > 0 && (
            <>
              <Link href={`/faktur/${str(sp.ref)}`} className="ml-2 underline">
                Lihat
              </Link>
              <a href={`/cetak/faktur/${str(sp.ref)}`} target="_blank" rel="noopener" className="underline">
                Cetak
              </a>
            </>
          )}
        </p>
      )}

      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_220px_auto]">
        <input name="q" defaultValue={str(sp.q)} placeholder="Cari no. kontrak, customer, bidang usaha…" className="input" />
        <label className="flex items-center gap-2 text-sm text-ink-2">
          <span className="whitespace-nowrap">Jatuh tempo s/d</span>
          <input name="sampai" type="date" defaultValue={sampai} className="input" />
        </label>
        <div className="flex gap-2">
          <button className="btn flex-1">Tampilkan</button>
          <Link href="/invoice" className="btn-ghost">
            Reset
          </Link>
        </div>
      </form>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap gap-x-6 gap-y-1 px-5 py-3 text-sm text-ink-2">
          <span>{rows.length} tagihan</span>
          <span>
            Total <b className="tabular text-ink">{formatRupiah(total)}</b>
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-y border-line bg-surface-2/50">
              <tr>
                <th className={th}>Jatuh Tempo</th>
                <th className={th}>No. Kontrak</th>
                <th className={th}>Customer</th>
                <th className={th}>Bidang Usaha</th>
                <th className={th}>Penagihan</th>
                <th className={th}>Periode</th>
                <th className={`${th} text-right`}>Nilai</th>
                <th className={th}>
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && <EmptyRow colSpan={8}>Tidak ada tagihan outstanding.</EmptyRow>}
              {rows.map(({ kontrak: k, periode: p }) => {
                const href = `/invoice/baru?kontrak=${k.noRef}${p.awal ? `&awal=${p.awal}` : ""}`;
                const terlambat = p.jatuhTempo < today;
                return (
                  <tr key={`${k.noRef}-${p.awal ?? "x"}`} className="hover:bg-surface-2/60">
                    <td className={`${td} whitespace-nowrap`}>
                      {formatTanggal(p.jatuhTempo)}
                      {terlambat && <div className="text-xs text-danger">Lewat jatuh tempo</div>}
                    </td>
                    <td className={td}>
                      <Link href={`/kontrak/${k.noRef}`} className="text-accent-ink hover:underline">
                        {k.noKontrak}
                      </Link>
                    </td>
                    <td className={td}>
                      <div>{k.customerNama ?? "-"}</div>
                      <div className="text-xs text-muted">{k.customer}</div>
                    </td>
                    <td className={td}>{k.lobNama ?? "-"}</td>
                    <td className={`${td} whitespace-nowrap text-ink-2`}>{labelJadwal(k)}</td>
                    <td className={`${td} whitespace-nowrap`}>{labelPeriode(p)}</td>
                    <td className={`${td} tabular text-right whitespace-nowrap`}>{formatRupiah(k.nilaiInvoice)}</td>
                    <td className={`${td} text-right`}>
                      <Link href={href} className="btn py-1.5 whitespace-nowrap">
                        Buat Invoice
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
