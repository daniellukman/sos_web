"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { kecilkanGambar } from "@/lib/kecilkan-gambar";
import type { AkunOption } from "@/lib/gl";
import { FOTO_MAX_TOTAL, checkFoto, formatBytes } from "@/lib/gl-foto";
import type { DraftAsal } from "@/lib/gl-foto-draft";
import { bacaFotoAction, type BacaFormState } from "./actions";
import AkunSelect from "./akun-select";
import KameraPicker from "./kamera-picker";

type Props = {
  perusahaan: string;
  /** "foto" = pilih file, "kamera" = potret langsung */
  asal: DraftAsal;
  tahunList: number[];
  namaBulan: string[];
  akunList: AkunOption[];
  initial: { tahun: number; bulan: number; akunDebet: string; akunKredit: string };
};

export default function BacaForm({ perusahaan, asal, tahunList, namaBulan, akunList, initial }: Props) {
  const [state, action, pending] = useActionState<BacaFormState, FormData>(bacaFotoAction.bind(null, perusahaan), {});
  const v = state.values ?? { tahun: String(initial.tahun), bulan: String(initial.bulan), akunDebet: initial.akunDebet, akunKredit: initial.akunKredit };
  const [files, setFiles] = useState<File[]>([]);
  const [mengecilkan, setMengecilkan] = useState(false);
  // Di HP tombol ada di bawah layar; pesan error ditampilkan juga di dekat tombol dan digulir ke sana
  const errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (state.error) errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [state]);
  // Foto dari file juga diperkecil ke maks. 200 KB sebelum dikirim (file yang sudah kecil dibiarkan)
  const pilihFile = async (list: File[]) => {
    setMengecilkan(true);
    try {
      setFiles(await Promise.all(list.map((f) => (/\.(jpe?g|png)$/i.test(f.name) ? kecilkanGambar(f, f.name) : f))));
    } catch {
      setFiles(list);
    } finally {
      setMengecilkan(false);
    }
  };
  const problems = files.map((f) => checkFoto(f) ?? (/\.(jpe?g|png)$/i.test(f.name) ? null : "hanya jpg/png yang bisa dibaca"));
  const total = files.reduce((s, f) => s + f.size, 0);
  const blocked = !files.length || problems.some(Boolean) || total > FOTO_MAX_TOTAL || mengecilkan;

  // Foto dikirim dari state (bukan <input name>), agar foto hasil kamera yang dikumpulkan satu per satu ikut terkirim
  const kirim = (fd: FormData) => {
    fd.delete("fotos");
    files.forEach((f) => fd.append("fotos", f, f.name));
    action(fd);
  };

  return (
    <form action={kirim} className="space-y-4">
      <input type="hidden" name="asal" value={asal} />
      <section className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="bulan" className="mb-1.5 block text-sm font-medium">
            Bulan
          </label>
          <select id="bulan" name="bulan" defaultValue={v.bulan} className="input">
            {namaBulan.map((n, i) => (
              <option key={n} value={i + 1}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tahun" className="mb-1.5 block text-sm font-medium">
            Tahun
          </label>
          <select id="tahun" name="tahun" defaultValue={v.tahun} className="input">
            {tahunList.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Account debet</label>
          <AkunSelect name="akunDebet" value={v.akunDebet} label="Account debet" akunList={akunList} required />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium">Account credit</label>
          <AkunSelect name="akunKredit" value={v.akunKredit} label="Account credit" akunList={akunList} required />
        </div>
      </section>

      <section className="card space-y-3 p-5">
        <div>
          <h2 className="font-medium">Foto bon / bill / invoice</h2>
          <p className="mt-0.5 text-xs text-muted">
            {asal === "kamera" ? "Potret satu bon per foto." : "jpg/png, bisa beberapa sekaligus."} Foto diperkecil otomatis ke maks. 200 KB sebelum dikirim. Tiap foto menjadi satu jurnal.
          </p>
        </div>
        {asal === "kamera" ? (
          <KameraPicker files={files} onChange={setFiles} />
        ) : (
          <input type="file" multiple accept=".jpg,.jpeg,.png" onChange={(ev) => void pilihFile(Array.from(ev.target.files ?? []))} className="block text-sm" />
        )}
        {files.length > 0 && (
          <p className="text-xs text-ink-2">
            {mengecilkan ? "Memperkecil foto…" : `${files.length} foto · ${formatBytes(total)}`}
            {problems.some(Boolean) && <span className="text-danger"> · ada file yang tidak valid: {files.filter((_, i) => problems[i]).map((f) => f.name).join(", ")}</span>}
            {total > FOTO_MAX_TOTAL && <span className="text-danger"> · total melebihi batas</span>}
          </p>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {state.error && !pending && (
          <p ref={errorRef} role="alert" className="flex-1 rounded-lg bg-danger-bg px-3 py-2 text-sm text-danger">
            {state.error}
          </p>
        )}
        <button className="btn min-w-40" disabled={pending || blocked}>
          {pending ? `Membaca ${files.length} foto…` : "Baca foto"}
        </button>
      </div>
    </form>
  );
}
