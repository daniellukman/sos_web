// Aturan file lampiran, dipakai di server dan browser (tanpa import server-only)

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per file
export const MAX_TOTAL_BYTES = 25 * 1024 * 1024; // 25 MB per sekali simpan

const MIME: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  msg: "application/vnd.ms-outlook",
  eml: "message/rfc822",
};

export const ALLOWED_EXTENSIONS = Object.keys(MIME);

// Hanya tipe yang aman dan bisa ditampilkan langsung oleh browser
const VIEWABLE = new Set(["pdf", "jpg", "jpeg", "png", "gif", "webp", "bmp", "txt", "csv"]);

export const extOf = (filename: string) => {
  const i = filename.lastIndexOf(".");
  return i > 0 ? filename.slice(i + 1).toLowerCase() : "";
};

export const mimeOf = (ext: string) => MIME[ext] ?? "application/octet-stream";
export const isViewable = (ext: string) => VIEWABLE.has(ext);

export function checkFile(file: { name: string; size: number }): string | null {
  const ext = extOf(file.name);
  if (!ALLOWED_EXTENSIONS.includes(ext)) return `Tipe file .${ext || "?"} tidak diizinkan.`;
  if (file.size === 0) return "File kosong.";
  if (file.size > MAX_FILE_BYTES) return `Ukuran melebihi ${formatBytes(MAX_FILE_BYTES)}.`;
  return null;
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
