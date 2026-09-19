// Aturan foto/lampiran jurnal, dipakai di server dan browser (tanpa import server-only)

export const FOTO_MAX_BYTES = 10 * 1024 * 1024; // 10 MB per file
export const FOTO_MAX_TOTAL = 25 * 1024 * 1024; // 25 MB per sekali simpan
export const FOTO_EXT = ["jpg", "jpeg", "png", "pdf"] as const;

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  pdf: "application/pdf",
};

export const extOf = (filename: string) => {
  const i = filename.lastIndexOf(".");
  return i > 0 ? filename.slice(i + 1).toLowerCase() : "";
};

export const isFotoExt = (ext: string) => (FOTO_EXT as readonly string[]).includes(ext);
export const isGambar = (ext: string) => ext === "jpg" || ext === "jpeg" || ext === "png";

/** Tipe konten dari EXT; jika EXT kosong (foto dari aplikasi desktop) tebak dari byte awal file. */
export function mimeFoto(ext: string, bytes: Uint8Array) {
  if (MIME[ext]) return MIME[ext];
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return "image/png";
  if (bytes[0] === 0x25 && bytes[1] === 0x50) return "application/pdf";
  return "application/octet-stream";
}

export function checkFoto(file: { name: string; size: number }): string | null {
  const ext = extOf(file.name);
  if (!isFotoExt(ext)) return `Tipe file .${ext || "?"} tidak diizinkan (${FOTO_EXT.join(", ")}).`;
  if (file.size === 0) return "File kosong.";
  if (file.size > FOTO_MAX_BYTES) return `Ukuran melebihi ${formatBytes(FOTO_MAX_BYTES)}.`;
  return null;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
