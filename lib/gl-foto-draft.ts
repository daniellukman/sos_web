import "server-only";
import { randomUUID } from "node:crypto";

// Draft "Jurnal dari Foto" disimpan di memori server (bukan tabel database) sampai diproses atau dibatalkan.
// Bentuknya meniru TRNHDR + TRNDTL: satu item = satu jurnal dengan 2 baris (debet & kredit).

export type DraftStatus = "ok" | "tanggal_acak" | "gagal";

export type DraftItem = {
  item: number;
  fileName: string;
  ext: string;
  bytes: Buffer;
  /** Hasil baca foto */
  status: DraftStatus;
  pesan: string;
  /** Tanggal yang terbaca di foto (YYYY-MM-DD) atau kosong */
  tanggalFoto: string;
  // --- kolom yang bisa diubah user (format TRNHDR/TRNDTL) ---
  tdate: string;
  remarks: string;
  ref1: string;
  akunDebet: string;
  akunKredit: string;
  nilai: number;
};

/** Asal gambar: menu "Jurnal dari Foto" (upload file) atau "Jurnal dari Kamera". */
export type DraftAsal = "foto" | "kamera";

export const draftPath = (asal: DraftAsal) => (asal === "kamera" ? "/jurnal-kamera" : "/jurnal-foto");

export type Draft = {
  id: string;
  asal: DraftAsal;
  perusahaan: string;
  userid: string;
  tahun: number;
  bulan: number;
  akunDebet: string;
  akunKredit: string;
  dibuat: number;
  items: DraftItem[];
};

const TTL_MS = 4 * 60 * 60 * 1000; // draft dibuang setelah 4 jam

// Simpan di globalThis agar tidak hilang saat hot reload di dev
const store = (globalThis as unknown as { glFotoDrafts?: Map<string, Draft> }).glFotoDrafts ?? new Map<string, Draft>();
(globalThis as unknown as { glFotoDrafts?: Map<string, Draft> }).glFotoDrafts = store;

function bersihkan() {
  const batas = Date.now() - TTL_MS;
  for (const [id, d] of store) if (d.dibuat < batas) store.delete(id);
}

export function simpanDraft(d: Omit<Draft, "id" | "dibuat">): Draft {
  bersihkan();
  const draft: Draft = { ...d, id: randomUUID(), dibuat: Date.now() };
  store.set(draft.id, draft);
  return draft;
}

/** Draft milik user & perusahaan ini; null jika tidak ada / sudah kedaluwarsa / bukan miliknya. */
export function ambilDraft(id: string, perusahaan: string, userid: string): Draft | null {
  bersihkan();
  const d = store.get(id);
  return d && d.perusahaan === perusahaan && d.userid.toUpperCase() === userid.toUpperCase() ? d : null;
}

export function hapusDraft(id: string) {
  store.delete(id);
}

/** Draft-draft user untuk perusahaan & menu ini (biasanya 0 atau 1), terbaru dulu. */
export function daftarDraft(perusahaan: string, userid: string, asal: DraftAsal): Draft[] {
  bersihkan();
  return [...store.values()]
    .filter((d) => d.perusahaan === perusahaan && d.asal === asal && d.userid.toUpperCase() === userid.toUpperCase())
    .sort((a, b) => b.dibuat - a.dibuat);
}
