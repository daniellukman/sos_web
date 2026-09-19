"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, createSession, verifyCredentials } from "@/lib/auth";
import { getUserCompanies } from "@/lib/company";

export type LoginState = { error?: string; userid?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const userid = String(formData.get("userid") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!userid || !password) return { error: "User ID dan password wajib diisi.", userid };

  let user;
  try {
    user = await verifyCredentials(userid, password);
    // Boleh masuk jika terdaftar untuk minimal satu perusahaan (dashboard SOS atau GL)
    if (user && (await getUserCompanies(user.userid)).length === 0) {
      return { error: "User ini belum terdaftar untuk perusahaan mana pun.", userid };
    }
  } catch (err) {
    console.error("Login gagal:", err);
    return { error: "Tidak dapat terhubung ke database. Coba lagi sebentar.", userid };
  }
  if (!user) return { error: "User ID atau password salah.", userid };

  await createSession(user);
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
