"use client";

import { useActionState, useState } from "react";
import type { AkunOption, InfoCopy, JurnalListRow } from "@/lib/gl";
import { isGambar } from "@/lib/gl-foto";
import { td, th } from "@/components/ui";
import { copyJurnalAction, type CopyFormState } from "./actions";

type Props = { tujuan: string; sumber: string; rows: (JurnalListRow & InfoCopy)[]; akunTujuan: AkunOption[] };

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const tanggal = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

export default function CopyForm({ tujuan, sumber, rows, akunTujuan }: Props) {
  const [state, action, pending] = useActionState<CopyFormState, FormData>(copyJurnalAction.bind(null, tujuan, sumber), {});
  const [dipilih, setDipilih] = useState<Set<number>>(new Set());
  const semua = rows.length > 0 && rows.every((r) => dipilih.has(r.noRef));
  const totalDipilih = rows.reduce((s, r) => s + (dipilih.has(r.noRef) ? r.total : 0), 0);

  const toggle = (noRef: number, on: boolean) =>
    setDipilih((s) => {
      const n = new Set(s);
      if (on) n.add(noRef);
      else n.delete(noRef);
      return n;
    });

  return (
    <form action={action} className="space-y-4">
      {state.error && (
        <p role="alert" className={`rounded-lg px-4 py-3 text-sm ${state.hilang ? "bg-warn-bg text-warn-ink" : "bg-danger-bg text-danger"}`}>
          {state.error}
        </p>
      )}

      {state.hilang && state.hilang.length > 0 && (
        <section className="card space-y-3 p-5">
          <h2 className="font-medium">Akun pengganti di {tujuan}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {state.hilang.map((h) => (
              <div key={h.akun}>
                <label htmlFor={`map-${h.akun}`} className="mb-1.5 block text-sm">
                  <span className="font-medium">{h.akun}</span> · {h.nama} <span className="text-muted">({sumber})</span>
                </label>
                <select id={`map-${h.akun}`} name={`map:${h.akun}`} defaultValue={state.map?.[h.akun] ?? ""} required className="input">
                  <option value="">— Pilih akun {tujuan} —</option>
                  {akunTujuan.map((a) => (
                    <option key={a.akun} value={a.akun}>
                      {a.akun} · {a.nama}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm text-ink-2">
          <span>
            {rows.length} jurnal di {sumber} · {dipilih.size} dipilih
            {dipilih.size > 0 && (
              <>
                {" "}
                · Total <b className="tabular text-ink">{rupiah.format(totalDipilih)}</b>
              </>
            )}
          </span>
          <button className="btn py-1.5" disabled={pending || dipilih.size === 0}>
            {pending ? "Menyalin…" : `Copy ${dipilih.size || ""} jurnal ke ${tujuan}`}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-y border-line bg-surface-2/50">
              <tr>
                <th className={`${th} w-10`}>
                  <input type="checkbox" checked={semua} onChange={(ev) => setDipilih(ev.target.checked ? new Set(rows.map((r) => r.noRef)) : new Set())} aria-label="Pilih semua" />
                </th>
                <th className={th}>Tanggal</th>
                <th className={th}>No. Jurnal</th>
                <th className={th}>Keterangan</th>
                <th className={th}>Account Biaya</th>
                <th className={`${th} text-right`}>Nilai</th>
                <th className={th}>Foto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted">
                    Tidak ada jurnal input (BMM) pada periode ini.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.noRef} className="hover:bg-surface-2/60">
                  <td className={td}>
                    <input type="checkbox" name="noRef" value={r.noRef} checked={dipilih.has(r.noRef)} onChange={(ev) => toggle(r.noRef, ev.target.checked)} aria-label={`Pilih ${r.tcode}`} />
                  </td>
                  <td className={`${td} whitespace-nowrap text-ink-2`}>{r.tanggal ? tanggal.format(new Date(r.tanggal)) : "-"}</td>
                  <td className={`${td} font-medium whitespace-nowrap`}>{r.tcode || `#${r.noRef}`}</td>
                  <td className={td}>{r.keterangan || <span className="text-muted">-</span>}</td>
                  <td className={td}>
                    {r.akunBiaya ? (
                      <>
                        <div className="font-medium whitespace-nowrap">{r.akunBiaya}</div>
                        <div className="text-xs text-muted">{r.namaBiaya}</div>
                      </>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                  <td className={`${td} tabular text-right whitespace-nowrap`}>{rupiah.format(r.total)}</td>
                  <td className={td}>
                    {r.foto ? (
                      <a href={`/api/gl-doc/${r.noRef}/${r.foto.item}`} target="_blank" rel="noopener" className="relative inline-block" title="Buka foto">
                        {isGambar(r.foto.ext) ? (
                          // eslint-disable-next-line @next/next/no-img-element -- foto dari database, bukan aset statis
                          <img src={`/api/gl-doc/${r.noRef}/${r.foto.item}`} alt={`Foto ${r.tcode}`} loading="lazy" className="h-14 w-16 rounded border border-line object-cover" />
                        ) : (
                          <span className="flex h-14 w-16 items-center justify-center rounded border border-line bg-surface-2 text-xs font-semibold text-ink-2 uppercase">{r.foto.ext}</span>
                        )}
                        {r.fotoCount > 1 && <span className="absolute -top-1.5 -right-1.5 rounded-full bg-accent px-1.5 text-[10px] font-semibold text-white">{r.fotoCount}</span>}
                      </a>
                    ) : (
                      <span className="text-muted">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </form>
  );
}
