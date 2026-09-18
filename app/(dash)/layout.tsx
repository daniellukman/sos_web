import { logout } from "@/app/actions";
import { getContext } from "@/lib/context";
import Nav from "./nav";

export default async function DashLayout({ children }: LayoutProps<"/">) {
  const { session, company } = await getContext();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-line bg-surface md:sticky md:top-0 md:flex md:h-screen md:w-60 md:flex-col md:border-r md:border-b-0">
        <div className="flex items-center gap-2.5 px-4 py-4 md:px-5 md:py-5">
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG vektor, tidak perlu optimasi next/image */}
          <img src="/logo-sos.svg" alt="Logo SOS" width={32} height={32} className="size-8" />
          <span className="font-semibold">SOS Dashboard</span>
        </div>
        <Nav />
        <div className="hidden border-t border-line p-4 md:mt-auto md:block">
          <p className="truncate text-sm font-medium">{session.name}</p>
          <p className="truncate text-xs text-muted">{session.userid}</p>
          <form action={logout} className="mt-3">
            <button className="btn-ghost w-full">Logout</button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 md:px-8">
          <span className="text-sm font-medium">{company?.nama ?? "PT. SOS"}</span>
          <form action={logout} className="md:hidden">
            <button className="btn-ghost py-1.5">Logout</button>
          </form>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8">
          {company ? (
            children
          ) : (
            <div className="card mx-auto max-w-lg p-8 text-center">
              <h1 className="font-semibold">Tidak ada akses ke PT. SOS</h1>
              <p className="mt-2 text-sm text-ink-2">
                User <b>{session.userid}</b> belum terdaftar untuk perusahaan SOS di tabel USER_PERUSAHAAN. Hubungi
                administrator.
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
