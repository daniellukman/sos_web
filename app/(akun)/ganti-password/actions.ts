"use server";

import { PASSWORD_MAX, PASSWORD_MIN, changePassword } from "@/lib/auth";
import { getContext } from "@/lib/context";

export type PasswordState = { error?: string; field?: "lama" | "baru" | "ulang"; ok?: boolean };

export async function gantiPassword(_prev: PasswordState, formData: FormData): Promise<PasswordState> {
  const { session } = await getContext();
  const lama = String(formData.get("lama") ?? "");
  const baru = String(formData.get("baru") ?? "");
  const ulang = String(formData.get("ulang") ?? "");

  if (!lama) return { error: "Isi password lama.", field: "lama" };
  if (baru.length < PASSWORD_MIN) return { error: `Password baru minimal ${PASSWORD_MIN} karakter.`, field: "baru" };
  if (new TextEncoder().encode(baru).length > PASSWORD_MAX) return { error: `Password baru maksimal ${PASSWORD_MAX} karakter.`, field: "baru" };
  if (baru === lama) return { error: "Password baru harus berbeda dari password lama.", field: "baru" };
  if (baru !== ulang) return { error: "Ulangi password baru dengan benar.", field: "ulang" };

  try {
    if (!(await changePassword(session.userid, lama, baru))) return { error: "Password lama salah.", field: "lama" };
  } catch (err) {
    console.error("Ganti password gagal:", err);
    return { error: "Gagal menyimpan ke database. Coba lagi." };
  }
  return { ok: true };
}
