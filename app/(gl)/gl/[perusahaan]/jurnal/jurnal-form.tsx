"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { AkunOption, CostCenter } from "@/lib/gl";
import { FOTO_EXT, FOTO_MAX_BYTES, checkFoto, formatBytes } from "@/lib/gl-foto";
import { formatAngka, parseRupiah } from "@/lib/rupiah";
import { saveJurnal, type JurnalFormState, type JurnalFormValues, type JurnalLineValues } from "./actions";

type Props = {
  perusahaan: string;
  /** null = jurnal baru */
  noRef: number | null;
  tcode: string | null;
  initial: JurnalFormValues;
  akunList: AkunOption[];
  ccList: CostCenter[];
  batalHref: string;
};

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 2 });
const kosong = (cc = ""): JurnalLineValues => ({ akun: "", keterangan: "", cc, debet: "", kredit: "" });
const nilai = (s: string) => (s ? parseRupiah(s) || 0 : 0);

export default function JurnalForm({ perusahaan, noRef, tcode, initial, akunList, ccList, batalHref }: Props) {
  const [state, action, pending] = useActionState<JurnalFormState, FormData>(saveJurnal.bind(null, perusahaan, noRef), {});
  const e = state.errors ?? {};
  const init = state.values ?? initial;

  const [tanggal, setTanggal] = useState(init.tanggal);
  const [remarks, setRemarks] = useState(init.remarks);
  const [lines, setLines] = useState<JurnalLineValues[]>(init.lines.length ? init.lines : [kosong(), kosong()]);
  const [files, setFiles] = useState<File[]>([]);

  const defaultCc = ccList[0]?.kode ?? "";
  const akunMap = new Map(akunList.map((a) => [a.akun, a]));
  const totalDebet = lines.reduce((s, l) => s + nilai(l.debet), 0);
  const totalKredit = lines.reduce((s, l) => s + nilai(l.kredit), 0);
  const selisih = Math.round((totalDebet - totalKredit) * 100) / 100;
  const fileProblems = files.map((f) => checkFoto(f));

  const ubah = (i: number, patch: Partial<JurnalLineValues>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const pilihAkun = (i: number, akun: string) => {
    // Cost center default: akun rugi laba memakai cost center pertama, akun neraca kosong (seperti aplikasi desktop)
    const a = akunMap.get(akun);
    ubah(i, { akun, cc: a?.rl ? defaultCc : "" });
  };
  const rapikan = (i: number, k: "debet" | "kredit") => {
    const n = nilai(lines[i][k]);
    // Mengisi satu sisi mengosongkan sisi lainnya
    ubah(i, { [k]: formatAngka(n), ...(n ? { [k === "debet" ? "kredit" : "debet"]: "" } : {}) });
  };
  const tambahBaris = () => {
    // Baris baru otomatis diisi sisa selisih agar jurnal cepat seimbang
    const l = kosong();
    if (selisih > 0) l.kredit = formatAngka(selisih);
    else if (selisih < 0) l.debet = formatAngka(-selisih);
    setLines((ls) => [...ls, l]);
  };

  const cell = "px-2 py-1.5 align-top";
  const inp = "input px-2 py-1.5";

  return (
    <form action={action} className="space-y-4">
      {e.form && (
        <p role="alert" className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">
          {e.form}
        </p>
      )}

      <section className="card grid gap-4 p-5 sm:grid-cols-[180px_200px_1fr]">
        <div>
          <label className="mb-1.5 block text-sm font-medium">No. Jurnal</label>
          <input className="input bg-surface-2 text-ink-2" value={tcode ?? "Otomatis (BMM/XXXX/MM/YY)"} readOnly tabIndex={-1} />
        </div>
        <div>
          <label htmlFor="tanggal" className="mb-1.5 block text-sm font-medium">
            Tanggal <span className="text-danger">*</span>
          </label>
          <input id="tanggal" name="tanggal" type="date" value={tanggal} onChange={(ev) => setTanggal(ev.target.value)} required className={`input ${e.tanggal ? "border-danger" : ""}`} />
          {e.tanggal && <p className="mt-1 text-xs text-danger">{e.tanggal}</p>}
        </div>
        <div>
          <label htmlFor="remarks" className="mb-1.5 block text-sm font-medium">
            Keterangan
          </label>
          <input id="remarks" name="remarks" value={remarks} onChange={(ev) => setRemarks(ev.target.value)} maxLength={100} placeholder="Keterangan jurnal" className={`input ${e.remarks ? "border-danger" : ""}`} />
          {e.remarks && <p className="mt-1 text-xs text-danger">{e.remarks}</p>}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
          <h2 className="font-medium">Baris jurnal</h2>
          <button type="button" onClick={tambahBaris} className="btn-ghost py-1.5">
            + Tambah baris
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="border-y border-line bg-surface-2/50 text-xs font-medium tracking-wide text-muted uppercase">
              <tr>
                <th className={`${cell} w-8 text-left`}>#</th>
                <th className={`${cell} w-72 text-left`}>Akun</th>
                <th className={`${cell} text-left`}>Keterangan</th>
                <th className={`${cell} w-24 text-left`}>CC</th>
                <th className={`${cell} w-40 text-right`}>Debet</th>
                <th className={`${cell} w-40 text-right`}>Kredit</th>
                <th className={`${cell} w-10`} />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {lines.map((l, i) => (
                <tr key={i} className={e.baris?.[i] ? "bg-danger-bg/40" : ""}>
                  <td className={`${cell} pt-3 text-sm text-muted`}>{i + 1}</td>
                  <td className={cell}>
                    <select name="akun" value={l.akun} onChange={(ev) => pilihAkun(i, ev.target.value)} className={inp} aria-label={`Akun baris ${i + 1}`}>
                      <option value="">— Pilih akun —</option>
                      {akunList.map((a) => (
                        <option key={a.akun} value={a.akun}>
                          {a.akun} · {a.nama}
                        </option>
                      ))}
                    </select>
                    {e.baris?.[i] && <p className="mt-1 text-xs text-danger">{e.baris[i]}</p>}
                  </td>
                  <td className={cell}>
                    <input name="keterangan" value={l.keterangan} onChange={(ev) => ubah(i, { keterangan: ev.target.value })} maxLength={100} className={inp} aria-label={`Keterangan baris ${i + 1}`} />
                  </td>
                  <td className={cell}>
                    <select name="cc" value={l.cc} onChange={(ev) => ubah(i, { cc: ev.target.value })} className={inp} aria-label={`Cost center baris ${i + 1}`}>
                      <option value="">-</option>
                      {ccList.map((c) => (
                        <option key={c.kode} value={c.kode}>
                          {c.kode}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className={cell}>
                    <input name="debet" value={l.debet} onChange={(ev) => ubah(i, { debet: ev.target.value })} onBlur={() => rapikan(i, "debet")} inputMode="decimal" className={`${inp} tabular text-right`} aria-label={`Debet baris ${i + 1}`} />
                  </td>
                  <td className={cell}>
                    <input name="kredit" value={l.kredit} onChange={(ev) => ubah(i, { kredit: ev.target.value })} onBlur={() => rapikan(i, "kredit")} inputMode="decimal" className={`${inp} tabular text-right`} aria-label={`Kredit baris ${i + 1}`} />
                  </td>
                  <td className={`${cell} text-center`}>
                    <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} disabled={lines.length <= 1} className="rounded-md px-2 py-1.5 text-ink-2 hover:bg-surface-2 hover:text-danger disabled:opacity-40" aria-label={`Hapus baris ${i + 1}`}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-line text-sm font-semibold">
              <tr>
                <td className={cell} colSpan={4}>
                  Total
                  {selisih !== 0 && <span className="ml-3 font-normal text-danger">Selisih {rupiah.format(Math.abs(selisih))}</span>}
                </td>
                <td className={`${cell} tabular text-right`}>{rupiah.format(totalDebet)}</td>
                <td className={`${cell} tabular text-right`}>{rupiah.format(totalKredit)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
        {e.lines && <p className="px-5 pb-3 text-xs text-danger">{e.lines}</p>}
      </section>

      <section className="card space-y-3 p-5">
        <div>
          <h2 className="font-medium">
            Foto bukti <span className="text-sm font-normal text-muted">(opsional)</span>
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {FOTO_EXT.join(", ")} · maks. {formatBytes(FOTO_MAX_BYTES)} per file. {noRef !== null && "Foto yang sudah ada dikelola di halaman jurnal."}
          </p>
        </div>
        <input type="file" name="fotos" multiple accept={FOTO_EXT.map((x) => `.${x}`).join(",")} onChange={(ev) => setFiles(Array.from(ev.target.files ?? []))} className="block text-sm" />
        {files.length > 0 && (
          <ul className="text-xs">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className={fileProblems[i] ? "text-danger" : "text-ink-2"}>
                {f.name} · {fileProblems[i] ?? formatBytes(f.size)}
              </li>
            ))}
          </ul>
        )}
        {e.fotos && <p className="text-xs text-danger">{e.fotos}</p>}
      </section>

      <div className="flex justify-end gap-2 pt-2">
        <Link href={batalHref} className="btn-ghost">
          Batal
        </Link>
        <button className="btn min-w-32" disabled={pending || selisih !== 0 || totalDebet === 0 || fileProblems.some(Boolean)}>
          {pending ? "Menyimpan…" : noRef !== null ? "Simpan perubahan" : "Simpan jurnal"}
        </button>
      </div>
    </form>
  );
}
