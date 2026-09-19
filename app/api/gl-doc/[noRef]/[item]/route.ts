import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserCompanies } from "@/lib/company";
import { getFoto } from "@/lib/gl-jurnal";
import { mimeFoto } from "@/lib/gl-foto";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/gl-doc/[noRef]/[item]">) {
  const session = await getSession();
  if (!session) return new Response("Silakan login.", { status: 401 });

  const p = await ctx.params;
  const [noRef, item] = [Number(p.noRef), Number(p.item)];
  if (![noRef, item].every(Number.isInteger)) return new Response("Tidak ditemukan.", { status: 404 });

  const foto = await getFoto(noRef, item);
  if (!foto) return new Response("Foto tidak ditemukan.", { status: 404 });
  // Foto milik jurnal perusahaan lain hanya boleh dilihat user yang terdaftar untuk perusahaan itu
  const companies = await getUserCompanies(session.userid);
  if (!companies.some((c) => c.kode === foto.perusahaan)) return new Response("Tidak ada akses.", { status: 403 });

  const bytes = new Uint8Array(foto.bytes);
  const mime = mimeFoto(foto.ext, bytes);
  const ext = foto.ext || (mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : mime === "application/pdf" ? "pdf" : "bin");
  const download = request.nextUrl.searchParams.get("download") === "1";

  return new Response(bytes, {
    headers: {
      "Content-Type": download ? "application/octet-stream" : mime,
      "Content-Length": String(bytes.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="Jurnal_${noRef}_foto${item}.${ext}"`,
      "X-Content-Type-Options": "nosniff",
      // File dari user: jangan izinkan script berjalan meski dibuka langsung
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; object-src 'self'",
      "Cache-Control": "private, no-store",
    },
  });
}
