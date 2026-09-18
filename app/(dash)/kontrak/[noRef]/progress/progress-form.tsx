"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import DocList, { type DocItem } from "@/components/doc-list";
import { ALLOWED_EXTENSIONS, MAX_FILE_BYTES, MAX_TOTAL_BYTES, checkFile, formatBytes } from "@/lib/documents";
import { saveProgress, type ProgressFormState } from "./actions";

type Props = {
  noRef: number;
  /** null = tambah progress baru */
  item: number | null;
  kontrakLabel: string;
  initial: { tanggal: string; deskripsi: string };
  today: string;
  docs: DocItem[];
};

export default function ProgressForm({ noRef, item, kontrakLabel, initial, today, docs }: Props) {
  const [state, action, pending] = useActionState<ProgressFormState, FormData>(saveProgress.bind(null, noRef, item), {});
  const v = state.values ?? initial;
  const e = state.errors ?? {};

  const fileInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const fileProblems = files.map((f) => checkFile(f));
  const total = files.reduce((s, f) => s + f.size, 0);
  const tooBig = total > MAX_TOTAL_BYTES;
  const blocked = fileProblems.some(Boolean) || tooBig;

  // Sinkronkan pilihan file (tambah/hapus) ke <input type="file"> yang sebenarnya dikirim
  const syncInput = (next: File[]) => {
    const dt = new DataTransfer();
    next.forEach((f) => dt.items.add(f));
    if (fileInput.current) fileInput.current.files = dt.files;
    setFiles(next);
  };

  return (
    <form action={action} className="space-y-4">
      {e.form && (
        <p role="alert" className="rounded-lg bg-danger-bg px-4 py-3 text-sm text-danger">
          {e.form}
        </p>
      )}

      <section className="card space-y-4 p-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
          <div>
            <label htmlFor="kontrak" className="mb-1.5 block text-sm font-medium">
              Kontrak
            </label>
            <input id="kontrak" className="input bg-surface-2 text-ink-2" value={kontrakLabel} readOnly tabIndex={-1} />
          </div>
          <div>
            <label htmlFor="tanggal" className="mb-1.5 block text-sm font-medium">
              Tanggal update <span className="text-danger">*</span>
            </label>
            <input
              id="tanggal"
              name="tanggal"
              type="date"
              key={`tanggal-${v.tanggal}`}
              defaultValue={v.tanggal}
              max={today}
              required
              aria-invalid={Boolean(e.tanggal)}
              className={`input ${e.tanggal ? "border-danger" : ""}`}
            />
            {e.tanggal && <p className="mt-1 text-xs text-danger">{e.tanggal}</p>}
          </div>
        </div>

        <div>
          <label htmlFor="deskripsi" className="mb-1.5 block text-sm font-medium">
            Deskripsi update <span className="text-danger">*</span>
          </label>
          <textarea
            id="deskripsi"
            name="deskripsi"
            key={`deskripsi-${v.deskripsi}`}
            defaultValue={v.deskripsi}
            rows={6}
            maxLength={2000}
            required
            placeholder="Apa yang dikerjakan / perkembangan kontrak"
            aria-invalid={Boolean(e.deskripsi)}
            className={`input ${e.deskripsi ? "border-danger" : ""}`}
          />
          {e.deskripsi && <p className="mt-1 text-xs text-danger">{e.deskripsi}</p>}
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <div>
          <h2 className="font-medium">
            Dokumen pendukung <span className="text-sm font-normal text-muted">(opsional)</span>
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            Maks. {formatBytes(MAX_FILE_BYTES)} per file, {formatBytes(MAX_TOTAL_BYTES)} per simpan. Tipe:{" "}
            {ALLOWED_EXTENSIONS.join(", ")}.
          </p>
        </div>

        {item !== null && docs.length > 0 && <DocList noRef={noRef} item={item} docs={docs} />}

        <input
          ref={fileInput}
          type="file"
          name="files"
          multiple
          accept={ALLOWED_EXTENSIONS.map((x) => `.${x}`).join(",")}
          className="sr-only"
          id="files"
          onChange={(ev) => {
            const added = Array.from(ev.target.files ?? []);
            // Gabungkan dengan file yang sudah dipilih sebelumnya
            syncInput([...files, ...added.filter((a) => !files.some((f) => f.name === a.name && f.size === a.size))]);
          }}
        />
        <label
          htmlFor="files"
          onDragOver={(ev) => ev.preventDefault()}
          onDrop={(ev) => {
            ev.preventDefault();
            syncInput([...files, ...Array.from(ev.dataTransfer.files)]);
          }}
          className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-line px-4 py-6 text-center transition hover:border-accent hover:bg-accent/5"
        >
          <span className="text-sm font-medium text-accent-ink">⬆ Upload dokumen</span>
          <span className="text-xs text-muted">Klik untuk memilih file, atau seret file ke sini</span>
        </label>

        {files.length > 0 && (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{f.name}</span>
                  <span className={`text-xs ${fileProblems[i] ? "text-danger" : "text-muted"}`}>
                    {fileProblems[i] ?? `${formatBytes(f.size)} · akan diupload saat disimpan`}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => syncInput(files.filter((_, j) => j !== i))}
                  className="rounded-md px-2 py-1 text-xs text-ink-2 hover:bg-surface-2 hover:text-danger"
                >
                  Batal
                </button>
              </li>
            ))}
          </ul>
        )}
        {tooBig && <p className="text-xs text-danger">Total ukuran file melebihi {formatBytes(MAX_TOTAL_BYTES)}.</p>}
        {e.files && <p className="text-xs text-danger">{e.files}</p>}
      </section>

      <div className="flex justify-end gap-2 pt-2">
        <Link href={`/kontrak/${noRef}#progress`} className="btn-ghost">
          Batal
        </Link>
        <button className="btn min-w-32" disabled={pending || blocked}>
          {pending ? (files.length ? "Mengupload…" : "Menyimpan…") : item !== null ? "Simpan perubahan" : "Simpan progress"}
        </button>
      </div>
    </form>
  );
}
