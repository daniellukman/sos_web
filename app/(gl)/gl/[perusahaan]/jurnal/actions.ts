"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAkunTransaksi, getCostCenters, getJurnal, isPeriodeAktif, NAMA_BULAN } from "@/lib/gl";
import { getGlContext, glPath } from "@/lib/gl-context";
import { FOTO_MAX_TOTAL, checkFoto, extOf, formatBytes } from "@/lib/gl-foto";
import { JURNAL_MAX, JurnalError, addFotos, deleteFoto, deleteJurnal, insertJurnal, updateJurnal, type JurnalInput, type NewFoto } from "@/lib/gl-jurnal";
import { parseRupiah } from "@/lib/rupiah";

export type JurnalLineValues = { akun: string; keterangan: string; cc: string; debet: string; kredit: string };
export type JurnalFormValues = { tanggal: string; remarks: string; lines: JurnalLineValues[] };
export type JurnalFormState = {
  values?: JurnalFormValues;
  errors?: { tanggal?: string; remarks?: string; lines?: string; baris?: Record<number, string>; fotos?: string; form?: string };
};

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
const labelBulan = (tanggal: string) => `${NAMA_BULAN[Number(tanggal.slice(5, 7)) - 1]} ${tanggal.slice(0, 4)}`;

function parseForm(formData: FormData): JurnalFormValues {
  const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");
  const kolom = (k: string) => formData.getAll(k).map(str);
  const [akun, keterangan, cc, debet, kredit] = ["akun", "keterangan", "cc", "debet", "kredit"].map(kolom);
  const n = Math.max(akun.length, debet.length, kredit.length);
  const lines: JurnalLineValues[] = [];
  for (let i = 0; i < n; i++) {
    const l = { akun: akun[i] ?? "", keterangan: keterangan[i] ?? "", cc: cc[i] ?? "", debet: debet[i] ?? "", kredit: kredit[i] ?? "" };
    // Baris yang sama sekali kosong diabaikan
    if (l.akun || l.keterangan || l.debet || l.kredit) lines.push(l);
  }
  return { tanggal: str(formData.get("tanggal")), remarks: str(formData.get("remarks")), lines };
}

/** Ambil file upload yang benar-benar dipilih (input kosong terkirim sebagai file 0 byte tanpa nama). */
function ambilFotos(formData: FormData): { files: File[]; error?: string } {
  const files = formData
    .getAll("fotos")
    .filter((f): f is File => f instanceof File && !(f.size === 0 && (f.name === "" || f.name === "blob")));
  const problems = files.map((f) => [f.name, checkFoto(f)] as const).filter(([, e]) => e);
  if (problems.length) return { files, error: problems.map(([name, e]) => `${name}: ${e}`).join(" ") };
  const total = files.reduce((s, f) => s + f.size, 0);
  if (total > FOTO_MAX_TOTAL) return { files, error: `Total ukuran file maksimal ${formatBytes(FOTO_MAX_TOTAL)} per simpan.` };
  return { files };
}

const toNewFoto = (files: File[]): Promise<NewFoto[]> =>
  Promise.all(files.map(async (f) => ({ ext: extOf(f.name), bytes: Buffer.from(await f.arrayBuffer()) })));

async function validate(perusahaan: string, v: JurnalFormValues): Promise<{ input: JurnalInput; errors: NonNullable<JurnalFormState["errors"]> }> {
  const errors: NonNullable<JurnalFormState["errors"]> = {};
  const baris: Record<number, string> = {};

  if (!isDate(v.tanggal)) errors.tanggal = "Tanggal jurnal wajib diisi.";
  else if (!(await isPeriodeAktif(perusahaan, v.tanggal))) errors.tanggal = `Periode ${labelBulan(v.tanggal)} tidak aktif (SETUPBULAN), jurnal tidak bisa disimpan.`;
  if (v.remarks.length > JURNAL_MAX.remarks) errors.remarks = `Maksimal ${JURNAL_MAX.remarks} karakter.`;

  const [akunList, ccList] = await Promise.all([getAkunTransaksi(perusahaan), getCostCenters(perusahaan)]);
  const akunSet = new Set(akunList.map((a) => a.akun));
  const ccSet = new Set(ccList.map((c) => c.kode));

  const lines: JurnalInput["lines"] = [];
  v.lines.forEach((l, i) => {
    const debet = l.debet ? parseRupiah(l.debet) : 0;
    const kredit = l.kredit ? parseRupiah(l.kredit) : 0;
    const masalah: string[] = [];
    if (!l.akun) masalah.push("pilih akun");
    else if (!akunSet.has(l.akun)) masalah.push(`akun ${l.akun} tidak ada / bukan akun transaksi`);
    if (l.keterangan.length > JURNAL_MAX.keterangan) masalah.push(`keterangan maks. ${JURNAL_MAX.keterangan} karakter`);
    if (l.cc && !ccSet.has(l.cc)) masalah.push("cost center tidak dikenal");
    if (!Number.isFinite(debet) || debet < 0 || !Number.isFinite(kredit) || kredit < 0) masalah.push("nilai tidak valid");
    else if (debet === 0 && kredit === 0) masalah.push("isi debet atau kredit");
    else if (debet > 0 && kredit > 0) masalah.push("isi salah satu saja: debet atau kredit");
    else if (debet >= 1e16 || kredit >= 1e16) masalah.push("nilai terlalu besar");
    if (masalah.length) baris[i] = masalah.join(", ");
    lines.push({ akun: l.akun, keterangan: l.keterangan, cc: l.cc, debet: Math.round(debet * 100) / 100, kredit: Math.round(kredit * 100) / 100 });
  });
  if (Object.keys(baris).length) errors.baris = baris;
  if (lines.length > JURNAL_MAX.lines) errors.lines = `Maksimal ${JURNAL_MAX.lines} baris.`;
  else if (lines.length < 2) errors.lines = "Jurnal minimal 2 baris (debet dan kredit).";
  else {
    const td = lines.reduce((s, l) => s + l.debet, 0);
    const tk = lines.reduce((s, l) => s + l.kredit, 0);
    if (Math.abs(td - tk) >= 0.005) errors.lines = "Total debet dan kredit harus sama.";
    else if (td === 0) errors.lines = "Nilai jurnal tidak boleh nol.";
  }
  return { input: { tanggal: v.tanggal, remarks: v.remarks, lines }, errors };
}

/** noRef null = jurnal baru. */
export async function saveJurnal(perusahaan: string, noRef: number | null, _prev: JurnalFormState, formData: FormData): Promise<JurnalFormState> {
  const { session } = await getGlContext(perusahaan);
  const values = parseForm(formData);
  try {
    const { input, errors } = await validate(perusahaan, values);
    const fotos = ambilFotos(formData);
    if (fotos.error) errors.fotos = fotos.error;

    if (noRef !== null && !errors.tanggal) {
      // Jurnal lama juga harus berada di periode yang masih aktif
      const lama = await getJurnal(perusahaan, noRef);
      if (!lama) return { values, errors: { form: "Jurnal tidak ditemukan, mungkin sudah dihapus." } };
      if (!(await isPeriodeAktif(perusahaan, lama.tanggal))) errors.form = `Periode asal jurnal (${labelBulan(lama.tanggal)}) sudah tidak aktif.`;
    }
    if (Object.keys(errors).length) return { values, errors };

    const files = await toNewFoto(fotos.files);
    if (noRef === null) noRef = await insertJurnal(perusahaan, input, files, session.userid);
    else if (!(await updateJurnal(perusahaan, noRef, input, files, session.userid)))
      return { values, errors: { form: "Jurnal tidak ditemukan, mungkin sudah dihapus." } };
  } catch (err) {
    if (err instanceof JurnalError) return { values, errors: { form: err.message } };
    console.error("Simpan jurnal gagal:", err);
    return { values, errors: { form: "Gagal menyimpan ke database. Coba lagi." } };
  }

  revalidatePath(glPath(perusahaan, "/jurnal"));
  redirect(glPath(perusahaan, `/jurnal/${noRef}?saved=1`));
}

export async function hapusJurnal(perusahaan: string, noRef: number): Promise<void> {
  await getGlContext(perusahaan);
  const j = await getJurnal(perusahaan, noRef);
  if (!j) redirect(glPath(perusahaan, "/jurnal"));
  if (!(await isPeriodeAktif(perusahaan, j.tanggal))) redirect(glPath(perusahaan, `/jurnal/${noRef}?err=periode`));
  try {
    await deleteJurnal(perusahaan, noRef);
  } catch (err) {
    console.error("Hapus jurnal gagal:", err);
    redirect(glPath(perusahaan, `/jurnal/${noRef}?err=hapus`));
  }
  revalidatePath(glPath(perusahaan, "/jurnal"));
  const [tahun, bulan] = [j.tanggal.slice(0, 4), Number(j.tanggal.slice(5, 7))];
  redirect(glPath(perusahaan, `/jurnal?deleted=${encodeURIComponent(j.tcode || String(noRef))}&tahun=${tahun}&dari=${bulan}&sampai=${bulan}`));
}

export type FotoFormState = { error?: string };

export async function tambahFoto(perusahaan: string, noRef: number, _prev: FotoFormState, formData: FormData): Promise<FotoFormState> {
  const { session } = await getGlContext(perusahaan);
  const j = await getJurnal(perusahaan, noRef);
  if (!j) return { error: "Jurnal tidak ditemukan." };
  if (!(await isPeriodeAktif(perusahaan, j.tanggal))) return { error: `Periode ${labelBulan(j.tanggal)} sudah tidak aktif.` };
  const fotos = ambilFotos(formData);
  if (fotos.error) return { error: fotos.error };
  if (!fotos.files.length) return { error: "Pilih foto dulu." };
  try {
    await addFotos(perusahaan, noRef, await toNewFoto(fotos.files), session.userid);
  } catch (err) {
    console.error("Upload foto jurnal gagal:", err);
    return { error: "Gagal menyimpan foto. Coba lagi." };
  }
  revalidatePath(glPath(perusahaan, `/jurnal/${noRef}`));
  redirect(glPath(perusahaan, `/jurnal/${noRef}?foto=1`));
}

export async function hapusFoto(perusahaan: string, noRef: number, item: number): Promise<void> {
  await getGlContext(perusahaan);
  const j = await getJurnal(perusahaan, noRef);
  if (!j) redirect(glPath(perusahaan, "/jurnal"));
  if (await isPeriodeAktif(perusahaan, j.tanggal)) {
    try {
      await deleteFoto(perusahaan, noRef, item);
    } catch (err) {
      console.error("Hapus foto jurnal gagal:", err);
    }
  }
  revalidatePath(glPath(perusahaan, `/jurnal/${noRef}`));
  redirect(glPath(perusahaan, `/jurnal/${noRef}`));
}
