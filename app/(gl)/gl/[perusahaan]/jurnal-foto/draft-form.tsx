"use client";

import { useActionState } from "react";
import type { AkunOption } from "@/lib/gl";
import { draftAction, type DraftFormState } from "./actions";
import AkunSelect from "./akun-select";

export type DraftRow = {
  item: number;
  fileName: string;
  status: "ok" | "tanggal_acak" | "gagal";
  pesan: string;
  tanggalFoto: string;
  tdate: string;
  remarks: string;
  ref1: string;
  akunDebet: string;
  akunKredit: string;
  nilai: string;
  fotoUrl: string;
};

type Props = { perusahaan: string; draftId: string; label: string; rows: DraftRow[]; akunList: AkunOption[]; min: string; max: string };

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export default function DraftForm({ perusahaan, draftId, label, rows, akunList, min, max }: Props) {
  const [state, action, pending] = useActionState<DraftFormState, FormData>(draftAction.bind(null, perusahaan, draftId), {});
  const cell = "px-2 py-1.5 align-top";
  const inp = "input px-2 py-1.5";
  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p role="alert" className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">
          {state.error}
        </p>
      )}
      {state.saved && !state.error && (
        <p role="status" className="rounded-lg bg-good-bg px-4 py-3 text-sm text-good">
          ✓ Perubahan draft disimpan. Klik &quot;Proses jadi jurnal&quot; untuk menyimpan ke jurnal sebenarnya.
        </p>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm text-ink-2">
          <span>
            {rows.length} jurnal draft · {label} · belum tersimpan ke jurnal
          </span>
          <div className="flex gap-2">
            <button name="mode" value="batal" className="btn-ghost py-1.5 text-danger hover:bg-danger-bg" disabled={pending}>
              Batal
            </button>
            <button name="mode" value="simpan" className="btn-ghost py-1.5" disabled={pending}>
              Simpan perubahan
            </button>
            <button name="mode" value="proses" className="btn py-1.5" disabled={pending || rows.length === 0}>
              {pending ? "Memproses…" : `Proses ${rows.length} jadi jurnal`}
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead className="border-y border-line bg-surface-2/50 text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className={`${cell} w-8 text-left`}>#</th>
                <th className={`${cell} w-24 text-left`}>Foto</th>
                <th className={`${cell} w-36 text-left`}>Tanggal</th>
                <th className={`${cell} text-left`}>Keterangan</th>
                <th className={`${cell} text-left`}>Keterangan baris</th>
                <th className={`${cell} w-52 text-left`}>Debet</th>
                <th className={`${cell} w-52 text-left`}>Credit</th>
                <th className={`${cell} w-36 text-right`}>Nilai</th>
                <th className={`${cell} w-14 text-center`}>Hapus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r) => {
                const masalah = state.baris?.[r.item];
                return (
                  <tr key={r.item} className={masalah || r.status === "gagal" ? "bg-danger-bg/40" : r.status === "tanggal_acak" ? "bg-warn-bg/40" : ""}>
                    <td className={`${cell} pt-3 text-sm text-muted`}>{r.item}</td>
                    <td className={cell}>
                      <a href={r.fotoUrl} target="_blank" rel="noopener" title={r.fileName}>
                        {/* eslint-disable-next-line @next/next/no-img-element -- foto dari memori server, bukan aset statis */}
                        <img src={r.fotoUrl} alt={r.fileName} className="h-16 w-20 rounded border border-line object-cover" loading="lazy" />
                      </a>
                    </td>
                    <td className={cell}>
                      <input type="date" name={`tdate_${r.item}`} defaultValue={r.tdate} min={min} max={max} className={inp} aria-label={`Tanggal ${r.item}`} />
                      {r.status === "tanggal_acak" && <p className="mt-1 text-xs text-warn-ink">Tanggal acak; di foto: {r.tanggalFoto || "tidak terbaca"}</p>}
                      {r.status === "gagal" && <p className="mt-1 text-xs text-danger">{r.pesan}</p>}
                      {masalah && <p className="mt-1 text-xs text-danger">{masalah}</p>}
                    </td>
                    <td className={cell}>
                      <input name={`remarks_${r.item}`} defaultValue={r.remarks} maxLength={100} className={inp} aria-label={`Keterangan ${r.item}`} />
                    </td>
                    <td className={cell}>
                      <input name={`ref1_${r.item}`} defaultValue={r.ref1} maxLength={100} className={inp} aria-label={`Keterangan baris ${r.item}`} />
                    </td>
                    <td className={cell}>
                      <AkunSelect name={`debet_${r.item}`} value={r.akunDebet} label="Debet" akunList={akunList} className={inp} />
                    </td>
                    <td className={cell}>
                      <AkunSelect name={`kredit_${r.item}`} value={r.akunKredit} label="Credit" akunList={akunList} className={inp} />
                    </td>
                    <td className={cell}>
                      <input name={`nilai_${r.item}`} defaultValue={r.nilai} inputMode="decimal" className={`${inp} tabular text-right`} aria-label={`Nilai ${r.item}`} />
                    </td>
                    <td className={`${cell} pt-3 text-center`}>
                      <input type="checkbox" name="hapus" value={r.item} aria-label={`Hapus baris ${r.item}`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t-2 border-line text-sm font-semibold">
              <tr>
                <td className={cell} colSpan={7}>
                  Total
                </td>
                <td className={`${cell} tabular text-right`}>{rupiah.format(rows.reduce((s, r) => s + (Number(r.nilai.replace(/\./g, "").replace(",", ".")) || 0), 0))}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
      <p className="text-xs text-muted">
        Baris merah: nilai tidak terbaca, isi manual atau centang Hapus. Baris kuning: tanggal di foto di luar periode, diisi tanggal acak. Klik foto untuk memperbesar.
      </p>
    </form>
  );
}
