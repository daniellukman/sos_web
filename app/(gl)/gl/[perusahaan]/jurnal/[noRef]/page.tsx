import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/confirm-button";
import { PageHeader, td, th } from "@/components/ui";
import { formatRupiah, formatTanggal, formatTanggalJam } from "@/lib/format";
import { getJurnal, isPeriodeAktif } from "@/lib/gl";
import { bukuBesarPath, getGlContext, glPath } from "@/lib/gl-context";
import { formatBytes, isGambar } from "@/lib/gl-foto";
import { JENIS_INPUT } from "@/lib/gl-jurnal";
import { angka } from "../../akun-cell";
import { hapusFoto, hapusJurnal } from "../actions";
import FotoForm from "./foto-form";

export const metadata: Metadata = { title: "GL — Jurnal" };

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function JurnalDetailPage({ params, searchParams }: PageProps<"/gl/[perusahaan]/jurnal/[noRef]">) {
  const { perusahaan, noRef: raw } = await params;
  await getGlContext(perusahaan);
  const noRef = Number(raw);
  if (!Number.isInteger(noRef)) notFound();
  const j = await getJurnal(perusahaan, noRef);
  if (!j) notFound();
  const sp = await searchParams;
  const aktif = await isPeriodeAktif(perusahaan, j.tanggal);
  const bisaUbah = aktif && j.jenis === JENIS_INPUT;

  const debet = j.lines.reduce((s, l) => s + l.debet, 0);
  const kredit = j.lines.reduce((s, l) => s + l.kredit, 0);
  const tahun = j.tanggal.slice(0, 4);
  const bulan = Number(j.tanggal.slice(5, 7));
  const q = `?tahun=${tahun}&dari=${bulan}&sampai=${bulan}`;
  const base = glPath(perusahaan, "/jurnal");
  const err = str(sp.err);

  const info: [string, string][] = [
    ["Tanggal", formatTanggal(j.tanggal)],
    ["Jenis", j.jenis === "EOM" ? "Tutup bulan (EOM)" : j.jenis || "-"],
    ["Keterangan", j.remarks || "-"],
    ["Dibuat", j.createUser ? `${j.createUser} · ${formatTanggalJam(j.createDate)}` : "-"],
    ["Terakhir disimpan", j.updateUser ? `${j.updateUser} · ${formatTanggalJam(j.updateDate)}` : "-"],
    ["Periode", aktif ? "Aktif — bisa diubah" : "Tidak aktif — hanya lihat"],
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`${base}${q}`} className="mb-4 inline-block text-sm text-accent-ink hover:underline">
        ← Daftar jurnal
      </Link>
      <PageHeader title={j.tcode || `Jurnal #${j.noRef}`} description={`No. Ref ${j.noRef}`}>
        {bisaUbah && (
          <div className="flex gap-2">
            <Link href={`${base}/${noRef}/edit`} className="btn-ghost">
              Edit
            </Link>
            <form action={hapusJurnal.bind(null, perusahaan, noRef)}>
              <ConfirmButton message={`Hapus jurnal ${j.tcode} beserta ${j.docs.length} foto? Tidak bisa dibatalkan.`} className="btn-ghost text-danger hover:bg-danger-bg">
                Hapus
              </ConfirmButton>
            </form>
          </div>
        )}
      </PageHeader>

      {str(sp.saved) === "1" && (
        <p role="status" className="mb-4 rounded-lg bg-good-bg px-4 py-3 text-sm text-good">
          ✓ Jurnal berhasil disimpan. Saldo di Neraca Saldo akan ikut berubah setelah proses posting.
        </p>
      )}
      {str(sp.foto) === "1" && (
        <p role="status" className="mb-4 rounded-lg bg-good-bg px-4 py-3 text-sm text-good">
          ✓ Foto berhasil diupload.
        </p>
      )}
      {err && (
        <p role="alert" className="mb-4 rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">
          {err === "periode" ? "Jurnal ini tidak bisa diubah: periodenya sudah tidak aktif atau bukan jurnal input." : "Gagal menghapus jurnal. Coba lagi."}
        </p>
      )}

      <dl className="card mb-4 grid gap-x-6 gap-y-3 p-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
        {info.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="mt-0.5">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="card mb-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-line bg-surface-2/50">
              <tr>
                <th className={th}>Akun</th>
                <th className={th}>Nama Akun</th>
                <th className={th}>Keterangan</th>
                <th className={th}>CC</th>
                <th className={`${th} text-right`}>Debet</th>
                <th className={`${th} text-right`}>Kredit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {j.lines.map((l, i) => (
                <tr key={i} className="hover:bg-surface-2/60">
                  <td className={`${td} whitespace-nowrap`}>
                    <Link href={bukuBesarPath(perusahaan, l.akun, { tahun: Number(tahun), dari: bulan, sampai: bulan })} className="font-medium text-accent-ink hover:underline">
                      {l.akun}
                    </Link>
                  </td>
                  <td className={td}>{l.nama}</td>
                  <td className={td}>{l.keterangan || <span className="text-muted">-</span>}</td>
                  <td className={`${td} text-ink-2`}>{l.cc || "-"}</td>
                  <td className={angka}>{l.debet ? formatRupiah(l.debet) : ""}</td>
                  <td className={angka}>{l.kredit ? formatRupiah(l.kredit) : ""}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-line font-semibold">
              <tr>
                <td className={td} colSpan={4}>
                  Total
                </td>
                <td className={angka}>{formatRupiah(debet)}</td>
                <td className={angka}>{formatRupiah(kredit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <section className="card space-y-4 p-5">
        <h2 className="font-medium">
          Foto bukti <span className="text-sm font-normal text-muted">({j.docs.length})</span>
        </h2>
        {j.docs.length === 0 ? (
          <p className="text-sm text-muted">Belum ada foto untuk jurnal ini.</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {j.docs.map((d) => {
              const url = `/api/gl-doc/${noRef}/${d.item}`;
              return (
                <li key={d.item} className="overflow-hidden rounded-lg border border-line">
                  <a href={url} target="_blank" rel="noopener" className="block bg-surface-2">
                    {isGambar(d.ext) ? (
                      // eslint-disable-next-line @next/next/no-img-element -- gambar dari database, bukan aset statis
                      <img src={url} alt={`Foto ${d.item}`} loading="lazy" className="h-48 w-full object-contain" />
                    ) : (
                      <div className="flex h-48 items-center justify-center text-sm font-semibold text-ink-2 uppercase">{d.ext}</div>
                    )}
                  </a>
                  <div className="flex items-center gap-2 px-3 py-2 text-xs text-ink-2">
                    <span className="min-w-0 flex-1 truncate">
                      Foto {d.item} · {formatBytes(d.filesize)}
                      {d.uploadUser && ` · ${d.uploadUser}`}
                    </span>
                    <a href={`${url}?download=1`} className="rounded-md px-2 py-1 text-accent-ink hover:bg-surface-2">
                      Unduh
                    </a>
                    {aktif && (
                      <form action={hapusFoto.bind(null, perusahaan, noRef, d.item)}>
                        <ConfirmButton message={`Hapus foto ${d.item}?`} className="rounded-md px-2 py-1 text-ink-2 hover:bg-surface-2 hover:text-danger">
                          Hapus
                        </ConfirmButton>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {aktif && <FotoForm perusahaan={perusahaan} noRef={noRef} />}
      </section>
    </div>
  );
}
