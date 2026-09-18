"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, createSession, verifyCredentials } from "@/lib/auth";
import { getCompany } from "@/lib/company";

export type LoginState = { error?: string; userid?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const userid = String(formData.get("userid") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!userid || !password) return { error: "User ID dan password wajib diisi.", userid };

  let user;
  try {
    user = await verifyCredentials(userid, password);
    if (user && !(await getCompany(user.userid))) {
      return { error: "User ini tidak punya akses ke PT. SOS.", userid };
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
