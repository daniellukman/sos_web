import { getSession } from "@/lib/auth";
import { mimeFoto } from "@/lib/gl-foto";
import { ambilDraft } from "@/lib/gl-foto-draft";

/** Foto dari draft "Jurnal dari Foto" (masih di memori server), hanya untuk pemilik draft. */
export async function GET(_request: Request, ctx: RouteContext<"/api/gl-foto-draft/[perusahaan]/[id]/[item]">) {
  const session = await getSession();
  if (!session) return new Response("Silakan login.", { status: 401 });
  const { perusahaan, id, item } = await ctx.params;
  const draft = ambilDraft(id, perusahaan, session.userid);
  const it = draft?.items.find((x) => x.item === Number(item));
  if (!it) return new Response("Tidak ditemukan.", { status: 404 });
  const bytes = new Uint8Array(it.bytes);
  return new Response(bytes, {
    headers: {
      "Content-Type": mimeFoto(it.ext, bytes),
      "Content-Length": String(bytes.length),
      "Content-Disposition": `inline; filename="${it.fileName.replace(/[^\w.-]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "sandbox; default-src 'none'; img-src 'self'",
      "Cache-Control": "private, no-store",
    },
  });
}
