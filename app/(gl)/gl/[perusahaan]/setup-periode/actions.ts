"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NAMA_BULAN } from "@/lib/gl";
import { getGlContext, glPath } from "@/lib/gl-context";
import { setPeriodeAktif, tambahPeriode } from "@/lib/gl-periode";

export type TambahState = { error?: string };

/** Tambah satu bulan, atau semua bulan dalam setahun (bulan = "semua"). */
export async function tambahPeriodeAction(perusahaan: string, _prev: TambahState, formData: FormData): Promise<TambahState> {
  await getGlContext(perusahaan);
  const tahun = Number(formData.get("tahun"));
  const bulanRaw = String(formData.get("bulan") ?? "");
  const active = formData.get("active") === "1";
  if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100) return { error: "Tahun tidak valid." };
  const bulanList = bulanRaw === "semua" ? Array.from({ length: 12 }, (_, i) => i + 1) : [Number(bulanRaw)];
  if (!bulanList.every((b) => Number.isInteger(b) && b >= 1 && b <= 12)) return { error: "Pilih bulan." };

  let n: number;
  try {
    n = await tambahPeriode(perusahaan, tahun, bulanList, active);
  } catch (err) {
    console.error("Tambah periode gagal:", err);
    return { error: "Gagal menyimpan ke database. Coba lagi." };
  }
  if (n === 0) return { error: bulanRaw === "semua" ? `Semua bulan ${tahun} sudah ada.` : `${NAMA_BULAN[bulanList[0] - 1]} ${tahun} sudah ada.` };

  revalidatePath(glPath(perusahaan, "/setup-periode"));
  redirect(glPath(perusahaan, `/setup-periode?added=${n}`));
}

export async function ubahAktifAction(perusahaan: string, tahun: number, bulan: number, active: boolean): Promise<void> {
  await getGlContext(perusahaan);
  try {
    await setPeriodeAktif(perusahaan, tahun, bulan, active);
  } catch (err) {
    console.error("Ubah status periode gagal:", err);
  }
  revalidatePath(glPath(perusahaan, "/setup-periode"));
}
