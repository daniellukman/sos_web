"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NAMA_BULAN, getAkunTransaksi, getCostCenters, isPeriodeAktif } from "@/lib/gl";
import { getGlContext, glPath } from "@/lib/gl-context";
import { copyJurnal, getJurnalSumber } from "@/lib/gl-jurnal";

export type AkunHilang = { akun: string; nama: string };
export type CopyFormState = {
  error?: string;
  /** Akun sumber yang tidak ada di perusahaan tujuan; user harus memilih penggantinya */
  hilang?: AkunHilang[];
  /** Pilihan pengganti yang sudah diisi user (dipertahankan saat form ditampilkan ulang) */
  map?: Record<string, string>;
};

const MAX_COPY = 100;

export async function copyJurnalAction(tujuan: string, sumber: string, _prev: CopyFormState, formData: FormData): Promise<CopyFormState> {
  const { session, companies } = await getGlContext(tujuan);
  if (sumber === tujuan || !companies.some((c) => c.kode === sumber)) return { error: "Perusahaan sumber tidak valid." };

  const noRefs = [...new Set(formData.getAll("noRef").map(Number).filter(Number.isInteger))];
  if (!noRefs.length) return { error: "Pilih minimal satu jurnal." };
  if (noRefs.length > MAX_COPY) return { error: `Maksimal ${MAX_COPY} jurnal sekali copy.` };

  const map: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (k.startsWith("map:") && typeof v === "string" && v) map[k.slice(4)] = v;

  try {
    const jurnal = await getJurnalSumber(sumber, noRefs);
    if (jurnal.length !== noRefs.length) return { error: "Ada jurnal yang tidak ditemukan di perusahaan sumber.", map };

    // Semua tanggal harus berada di bulan yang masih aktif di perusahaan tujuan
    const bulanSet = [...new Set(jurnal.map((j) => j.tanggal.slice(0, 7)))];
    for (const ym of bulanSet) {
      if (!(await isPeriodeAktif(tujuan, `${ym}-01`)))
        return { error: `Periode ${NAMA_BULAN[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)} tidak aktif di ${tujuan}. Jurnal bulan itu tidak bisa dicopy.`, map };
    }

    // Akun sumber yang tidak ada di tujuan harus dipetakan ke akun tujuan yang valid
    const [akunTujuan, ccTujuan] = await Promise.all([getAkunTransaksi(tujuan), getCostCenters(tujuan)]);
    const valid = new Set(akunTujuan.map((a) => a.akun));
    const hilang = new Map<string, string>();
    for (const j of jurnal) for (const l of j.lines) if (!valid.has(l.akun)) hilang.set(l.akun, l.nama);
    const belum = [...hilang].filter(([akun]) => !valid.has(map[akun] ?? ""));
    if (belum.length) {
      return {
        hilang: [...hilang].map(([akun, nama]) => ({ akun, nama })),
        map,
        error: `${belum.length} akun tidak ada di ${tujuan}. Pilih akun penggantinya lalu copy lagi.`,
      };
    }
    const mapDipakai = Object.fromEntries([...hilang.keys()].map((a) => [a, map[a]]));

    const hasil = await copyJurnal(tujuan, jurnal, mapDipakai, new Set(ccTujuan.map((c) => c.kode)), session.userid);
    revalidatePath(glPath(tujuan, "/jurnal"));
    const [tahun, bulan] = [bulanSet[0].slice(0, 4), Number(bulanSet[0].slice(5, 7))];
    redirect(glPath(tujuan, `/jurnal?copied=${hasil.length}&tahun=${tahun}&dari=${bulan}&sampai=${bulan}`));
  } catch (err) {
    // redirect() bekerja dengan melempar error; teruskan
    if (err && typeof err === "object" && "digest" in err && String((err as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) throw err;
    console.error("Copy jurnal gagal:", err);
    return { error: "Gagal menyalin jurnal ke database. Coba lagi.", map };
  }
}
