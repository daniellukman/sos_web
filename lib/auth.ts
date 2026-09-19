import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { getPool, sql } from "@/lib/db";

export const SESSION_COOKIE = "sos_session";
const SESSION_HOURS = 8;

export type Session = { userid: string; name: string; exp: number };

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET belum diisi (minimal 32 karakter)");
  return s;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function encode(session: Session) {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function decode(token: string): Session | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
    return session.exp > Date.now() ? session : null;
  } catch {
    return null;
  }
}

/** Cek userid + password terhadap USERTBL (kolom PWD berisi hash bcrypt). */
export async function verifyCredentials(userid: string, password: string) {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("userid", sql.VarChar(50), userid)
    .query<{ USERID: string; NAME: string | null; PWD: string | null }>(
      "SELECT TOP 1 USERID, NAME, PWD FROM dbo.USERTBL WHERE USERID = @userid",
    );
  const user = result.recordset[0];
  // Tetap jalankan bcrypt meski user tidak ada, agar waktu respons tidak membocorkan userid yang valid
  const hash = user?.PWD ?? "$2a$11$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
  const ok = await bcrypt.compare(password, hash);
  if (!user || !ok) return null;
  return { userid: user.USERID, name: user.NAME || user.USERID };
}

export const PASSWORD_MIN = 6;
// bcrypt hanya memakai 72 byte pertama; lebih dari itu tidak aman dipakai
export const PASSWORD_MAX = 72;

/**
 * Ganti password user di USERTBL setelah password lama dicek. false jika password lama salah.
 * Hash dibuat dengan cost 12 dan awalan $2a$ (format yang dibaca aplikasi desktop; hash cost 12 sudah terbukti diterima desktop)
 * (bcryptjs menulis $2b$; algoritmanya identik untuk password ≤ 72 byte).
 */
export async function changePassword(userid: string, lama: string, baru: string): Promise<boolean> {
  if (!(await verifyCredentials(userid, lama))) return false;
  // Fungsi pengganti (bukan string) agar "$2" tidak dibaca sebagai referensi grup regex
  const hash = (await bcrypt.hash(baru, 12)).replace(/^\$2b\$/, () => "$2a$");
  const pool = await getPool();
  const r = await pool
    .request()
    .input("userid", sql.VarChar(50), userid)
    .input("pwd", sql.VarChar(255), hash)
    .query("UPDATE dbo.USERTBL SET PWD = @pwd WHERE USERID = @userid");
  return r.rowsAffected[0] > 0;
}

export async function createSession(user: { userid: string; name: string }) {
  const exp = Date.now() + SESSION_HOURS * 60 * 60 * 1000;
  const store = await cookies();
  store.set(SESSION_COOKIE, encode({ ...user, exp }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(exp),
  });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? decode(token) : null;
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
