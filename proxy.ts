import { NextResponse, type NextRequest } from "next/server";

// Pengecekan cepat saja: tanpa cookie sesi langsung ke /login.
// Validasi tanda tangan sesi yang sebenarnya dilakukan di server (lib/auth.ts).
export function proxy(request: NextRequest) {
  if (!request.cookies.has("sos_session")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Kecualikan halaman login, aset Next.js, dan gambar publik (mis. /logo-sos.svg)
  matcher: ["/((?!login|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
