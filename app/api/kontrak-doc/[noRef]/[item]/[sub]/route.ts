import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { isViewable, mimeOf } from "@/lib/documents";
import { getKontrak } from "@/lib/kontrak";
import { getDocument } from "@/lib/progress";

export async function GET(request: NextRequest, ctx: RouteContext<"/api/kontrak-doc/[noRef]/[item]/[sub]">) {
  const session = await getSession();
  if (!session) return new Response("Silakan login.", { status: 401 });
  if (!(await getCompany(session.userid))) return new Response("Tidak ada akses.", { status: 403 });

  const p = await ctx.params;
  const [noRef, item, sub] = [Number(p.noRef), Number(p.item), Number(p.sub)];
  if (![noRef, item, sub].every(Number.isInteger)) return new Response("Tidak ditemukan.", { status: 404 });

  const doc = await getDocument(noRef, item, sub);
  if (!doc) return new Response("Dokumen tidak ditemukan.", { status: 404 });

  const kontrak = await getKontrak(noRef);
  const base = (kontrak?.noKontrak || String(noRef)).replace(/[^\w.-]/g, "_");
  const filename = `Kontrak_${base}_progress${item}_dok${sub}${doc.ext ? `.${doc.ext}` : ""}`;
  const inline = request.nextUrl.searchParams.get("download") !== "1" && isViewable(doc.ext);

  return new Response(new Uint8Array(doc.bytes), {
    headers: {
      "Content-Type": inline ? mimeOf(doc.ext) : "application/octet-stream",
      "Content-Length": String(doc.bytes.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
      // File dari user: jangan izinkan script berjalan meski dibuka langsung
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; object-src 'self'",
      "Cache-Control": "private, no-store",
    },
  });
}
