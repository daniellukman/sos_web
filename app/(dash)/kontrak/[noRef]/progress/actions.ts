"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/context";
import { MAX_TOTAL_BYTES, checkFile, extOf, formatBytes } from "@/lib/documents";
import { getKontrak } from "@/lib/kontrak";
import { insertProgress, updateProgress, type NewFile } from "@/lib/progress";

export type ProgressFormState = {
  values?: { tanggal: string; deskripsi: string };
  errors?: { tanggal?: string; deskripsi?: string; files?: string; form?: string };
};

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const todayWib = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

/** item null = tambah progress baru untuk kontrak noRef. */
export async function saveProgress(
  noRef: number,
  item: number | null,
  _prev: ProgressFormState,
  formData: FormData,
): Promise<ProgressFormState> {
  const { session, company } = await getContext();
  const values = {
    tanggal: String(formData.get("tanggal") ?? "").trim(),
    deskripsi: String(formData.get("deskripsi") ?? "").trim(),
  };
  const errors: NonNullable<ProgressFormState["errors"]> = {};
  if (!company) return { values, errors: { form: "User ini tidak punya akses ke PT. SOS." } };

  if (!isDate(values.tanggal)) errors.tanggal = "Tanggal wajib diisi.";
  else if (values.tanggal > todayWib()) errors.tanggal = "Tanggal tidak boleh lebih dari hari ini.";
  if (!values.deskripsi) errors.deskripsi = "Deskripsi update wajib diisi.";
  else if (values.deskripsi.length > 2000) errors.deskripsi = "Maksimal 2000 karakter.";

  // Input file yang kosong tetap terkirim sebagai file 0 byte tanpa nama (bisa bernama "" atau "blob"),
  // jadi abaikan entri itu. File kosong dengan nama asli tetap diperiksa dan ditolak oleh checkFile.
  const uploads = formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && !(f.size === 0 && (f.name === "" || f.name === "blob")));
  const problems = uploads.map((f) => [f.name, checkFile(f)] as const).filter(([, e]) => e);
  const total = uploads.reduce((s, f) => s + f.size, 0);
  if (problems.length) errors.files = problems.map(([name, e]) => `${name}: ${e}`).join(" ");
  else if (total > MAX_TOTAL_BYTES) errors.files = `Total ukuran file maksimal ${formatBytes(MAX_TOTAL_BYTES)} per simpan.`;

  if (Object.keys(errors).length) return { values, errors };

  try {
    if (!(await getKontrak(noRef))) return { values, errors: { form: "Kontrak tidak ditemukan." } };

    const files: NewFile[] = await Promise.all(
      uploads.map(async (f) => ({ ext: extOf(f.name), bytes: Buffer.from(await f.arrayBuffer()) })),
    );
    if (item === null) {
      item = await insertProgress(noRef, values, files, session.userid);
    } else if (!(await updateProgress(noRef, item, values, files, session.userid))) {
      return { values, errors: { form: "Progress tidak ditemukan, mungkin sudah dihapus." } };
    }
  } catch (err) {
    console.error("Simpan progress gagal:", err);
    return { values, errors: { form: "Gagal menyimpan ke database. Coba lagi." } };
  }

  revalidatePath(`/kontrak/${noRef}`);
  redirect(`/kontrak/${noRef}?progress=${item}#progress`);
}
