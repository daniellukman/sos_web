import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContext } from "@/lib/context";
import { getCetakInfo, getFaktur } from "@/lib/faktur";
import { formatRupiah, formatTanggal, formatTanggalPanjang } from "@/lib/format";
import { terbilang } from "@/lib/terbilang";
import PrintButton from "./print-button";

export async function generateMetadata({ params }: PageProps<"/cetak/faktur/[noRef]">): Promise<Metadata> {
  // Judul tab dipakai browser sebagai nama file saat "Simpan sebagai PDF"
  const f = await getFaktur(Number((await params).noRef));
  return { title: { absolute: f?.noFaktur ? f.noFaktur.replaceAll("/", "-") : "Invoice" } };
}

export default async function CetakFakturPage({ params }: PageProps<"/cetak/faktur/[noRef]">) {
  const { company } = await getContext();
  if (!company) return <p className="p-8 text-center">User ini tidak punya akses ke PT. SOS.</p>;

  const noRef = Number((await params).noRef);
  if (!Number.isInteger(noRef)) notFound();
  const f = await getFaktur(noRef);
  if (!f) notFound();
  const { perusahaan, customer } = await getCetakInfo(f.customer);

  return (
    <main className="min-h-screen bg-neutral-200 py-8 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] justify-end gap-2 px-4">
        <PrintButton />
      </div>

      {/* Lembar A4 — warna tetap terang di mode gelap agar sama dengan hasil cetak */}
      <article className="invoice-sheet mx-auto max-w-[210mm] bg-white p-[15mm] text-[13px] leading-relaxed text-neutral-900 shadow-xl print:max-w-none print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-6 border-b-2 border-neutral-900 pb-5">
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG vektor */}
            <img src="/logo-sos.svg" alt="Logo SOS" width={64} height={64} className="size-16" />
            <div>
              <p className="text-lg font-bold">{perusahaan.nama}</p>
              <p className="text-neutral-600">Star Office Solutions</p>
              {perusahaan.alamat && <p className="text-neutral-600">{perusahaan.alamat}</p>}
              {perusahaan.npwp && <p className="text-neutral-600">NPWP {perusahaan.npwp}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold tracking-widest">INVOICE</p>
            <p className="mt-1 font-semibold">{f.noFaktur}</p>
          </div>
        </header>

        <section className="mt-6 grid grid-cols-2 gap-8">
          <div>
            <p className="text-xs font-semibold tracking-wide text-neutral-500 uppercase">Ditagihkan kepada</p>
            <p className="mt-1 font-semibold">{customer.nama}</p>
            {customer.alamat.map((a) => (
              <p key={a}>{a}</p>
            ))}
            {customer.npwp && <p>NPWP {customer.npwp}</p>}
            {customer.telp && <p>Telp {customer.telp}</p>}
            {customer.email && <p>{customer.email}</p>}
          </div>
          <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-1 justify-self-end">
            <dt className="text-neutral-500">Tanggal</dt>
            <dd className="font-medium">{formatTanggalPanjang(f.tanggal)}</dd>
            {f.noKontrak && (
              <>
                <dt className="text-neutral-500">No. Kontrak</dt>
                <dd className="font-medium">{f.noKontrak}</dd>
              </>
            )}
            {f.lobNama && (
              <>
                <dt className="text-neutral-500">Bidang Usaha</dt>
                <dd className="font-medium">{f.lobNama}</dd>
              </>
            )}
          </dl>
        </section>

        <table className="mt-8 w-full border-collapse">
          <thead>
            <tr className="border-y border-neutral-900 text-left text-xs tracking-wide uppercase">
              <th className="py-2 pr-2 font-semibold">No</th>
              <th className="py-2 pr-2 font-semibold">Deskripsi</th>
              <th className="py-2 pr-2 text-right font-semibold">Qty</th>
              <th className="py-2 pr-2 text-right font-semibold">Harga</th>
              <th className="py-2 text-right font-semibold">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {f.lines.map((l, i) => (
              <tr key={l.item} className="border-b border-neutral-300 align-top">
                <td className="py-2 pr-2">{i + 1}</td>
                <td className="py-2 pr-2 whitespace-pre-line">
                  {l.deskripsi}
                  {l.tanggalAwal && l.tanggalAkhir && !l.deskripsi.includes(formatTanggal(l.tanggalAwal)) && (
                    <span className="block text-neutral-500">
                      Periode {formatTanggal(l.tanggalAwal)} – {formatTanggal(l.tanggalAkhir)}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-2 text-right tabular-nums">{l.qty}</td>
                <td className="py-2 pr-2 text-right whitespace-nowrap tabular-nums">{formatRupiah(l.harga)}</td>
                <td className="py-2 text-right whitespace-nowrap tabular-nums">{formatRupiah(l.nilai)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="mt-4 flex justify-end">
          <dl className="grid w-72 grid-cols-[1fr_auto] gap-x-6 gap-y-1">
            <dt className="text-neutral-600">Subtotal</dt>
            <dd className="text-right tabular-nums">{formatRupiah(f.nilaiSebelumPpn)}</dd>
            <dt className="text-neutral-600">PPN {f.pctPpn.toLocaleString("id-ID")}%</dt>
            <dd className="text-right tabular-nums">{formatRupiah(f.nilaiPpn)}</dd>
            <dt className="mt-1 border-t border-neutral-900 pt-1 font-bold">Total</dt>
            <dd className="mt-1 border-t border-neutral-900 pt-1 text-right font-bold tabular-nums">{formatRupiah(f.nilaiAkhir)}</dd>
          </dl>
        </section>

        <p className="mt-4 rounded bg-neutral-100 px-3 py-2 italic print:bg-transparent print:px-0">
          Terbilang: {terbilang(f.nilaiAkhir)}
        </p>

        {f.keterangan && (
          <p className="mt-4">
            <span className="text-neutral-500">Keterangan: </span>
            {f.keterangan}
          </p>
        )}

        <footer className="mt-16 flex justify-end">
          <div className="w-56 text-center">
            <p>Hormat kami,</p>
            <div className="h-20" />
            <p className="border-t border-neutral-900 pt-1 font-semibold">{perusahaan.nama}</p>
          </div>
        </footer>
      </article>
    </main>
  );
}
