import Link from "next/link";
import type { ReactNode } from "react";
import { logout } from "@/app/actions";
import Nav from "@/components/nav";
import type { Company } from "@/lib/company";
import type { Session } from "@/lib/auth";

type Props = {
  session: Session;
  /** Akses ke dashboard PT. SOS (menu customer/kontrak/invoice) */
  hasSos: boolean;
  /** Perusahaan untuk sub-menu GL */
  companies: Company[];
  /** Teks di header atas */
  title: string;
  children: ReactNode;
};

/** Kerangka halaman: sidebar + header, dipakai layout dashboard SOS dan layout GL. */
export default function Shell({ session, hasSos, companies, title, children }: Props) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-line bg-surface md:sticky md:top-0 md:flex md:h-screen md:w-60 md:flex-col md:border-r md:border-b-0">
        <div className="flex items-center gap-2.5 px-4 py-4 md:px-5 md:py-5">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG vektor, tidak perlu optimasi next/image */}
          <img src="/logo-sos.svg" alt="Logo SOS" width={32} height={32} className="size-8" />
          <span className="font-semibold">SOS Dashboard</span>
        </div>
        <Nav hasSos={hasSos} companies={companies} />
        <div className="hidden border-t border-line p-4 md:mt-auto md:block">
          <p className="truncate text-sm font-medium">{session.name}</p>
          <p className="truncate text-xs text-muted">{session.userid}</p>
          <Link href="/ganti-password" className="btn-ghost mt-3 w-full">
            Change Password
          </Link>
          <form action={logout} className="mt-2">
            <button className="btn-ghost w-full">Logout</button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 md:px-8">
          <span className="text-sm font-medium">{title}</span>
          <div className="flex gap-2 md:hidden">
            <Link href="/ganti-password" className="btn-ghost py-1.5">
              Change Password
            </Link>
            <form action={logout}>
              <button className="btn-ghost py-1.5">Logout</button>
            </form>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
