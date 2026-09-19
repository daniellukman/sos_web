import Shell from "@/components/shell";
import { getContext } from "@/lib/context";

/** Layout menu GL: tidak butuh akses PT. SOS, cukup terdaftar di USER_PERUSAHAAN. */
export default async function GlLayout({ children }: LayoutProps<"/">) {
  const { session, company, companies } = await getContext();

  return (
    <Shell session={session} hasSos={!!company} companies={companies} title="General Ledger">
      {companies.length ? (
        children
      ) : (
        <div className="card mx-auto max-w-lg p-8 text-center">
          <h1 className="font-semibold">Tidak ada akses GL</h1>
          <p className="mt-2 text-sm text-ink-2">
            User <b>{session.userid}</b> belum terdaftar untuk perusahaan mana pun di tabel USER_PERUSAHAAN.
          </p>
        </div>
      )}
    </Shell>
  );
}
