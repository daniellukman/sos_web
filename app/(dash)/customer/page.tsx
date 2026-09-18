import type { Metadata } from "next";
import Link from "next/link";
import { EmptyRow, PageHeader, td, th } from "@/components/ui";
import { getContext } from "@/lib/context";
import { formatRupiah } from "@/lib/format";
import { getCustomers } from "@/lib/queries";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ searchParams }: PageProps<"/customer">) {
  const { company } = await getContext();
  if (!company) return null;

  const sp = await searchParams;
  const q = String(sp.q ?? "").trim();
  const saved = sp.saved === "create" ? "ditambahkan" : sp.saved === "edit" ? "diperbarui" : null;
  const rows = await getCustomers(company.kode, q);

  return (
    <>
      <PageHeader title="Customer" description={`Nilai penjualan dihitung untuk ${company.nama}`}>
        <div className="flex flex-wrap gap-2">
          <form className="flex gap-2">
            <input name="q" defaultValue={q} placeholder="Cari kode, nama, email…" className="input w-56" />
            <button className="btn-ghost">Cari</button>
          </form>
          <Link href="/customer/baru" className="btn">
            + Tambah customer
          </Link>
        </div>
      </PageHeader>

      {saved && (
        <p role="status" className="mb-4 flex items-center gap-2 rounded-lg bg-good-bg px-4 py-3 text-sm text-good">
          <span aria-hidden>✓</span> Customer {q} berhasil {saved}.
        </p>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-surface-2/50">
              <tr>
                <th className={th}>Kode</th>
                <th className={th}>Nama</th>
                <th className={th}>Kontak</th>
                <th className={`${th} text-right`}>Faktur</th>
                <th className={`${th} text-right`}>Total Penjualan</th>
                <th className={`${th} text-right`}>Piutang</th>
                <th className={th}>
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && (
                <EmptyRow colSpan={7}>
                  {saved ? "Data tersimpan, tetapi tidak ditandai sebagai Customer." : "Customer tidak ditemukan."}
                </EmptyRow>
              )}
              {rows.map((c) => (
                <tr key={c.kode} className="hover:bg-surface-2/60">
                  <td className={`${td} text-ink-2`}>{c.kode}</td>
                  <td className={td}>
                    <div className="font-medium">{c.nama}</div>
                    {c.npwp && <div className="text-xs text-muted">NPWP {c.npwp}</div>}
                  </td>
                  <td className={`${td} text-ink-2`}>
                    {[c.contact, c.telp, c.email].filter(Boolean).join(" · ") || "-"}
                  </td>
                  <td className={`${td} tabular text-right`}>{c.jumlahFaktur}</td>
                  <td className={`${td} tabular text-right whitespace-nowrap`}>{formatRupiah(c.totalPenjualan)}</td>
                  <td className={`${td} tabular text-right whitespace-nowrap`}>
                    {c.piutang > 0 ? formatRupiah(c.piutang) : <span className="text-muted">-</span>}
                  </td>
                  <td className={`${td} text-right`}>
                    <Link
                      href={`/customer/${encodeURIComponent(c.kode)}`}
                      className="text-accent-ink hover:underline"
                    >
                      Edit
                    </Link>
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
