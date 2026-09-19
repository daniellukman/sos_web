import Shell from "@/components/shell";
import { getContext } from "@/lib/context";

export default async function DashLayout({ children }: LayoutProps<"/">) {
  const { session, company, companies } = await getContext();

  return (
    <Shell session={session} hasSos={!!company} companies={companies} title={company?.nama ?? "PT. SOS"}>
      {company ? (
        children
      ) : (
        <div className="card mx-auto max-w-lg p-8 text-center">
          <h1 className="font-semibold">Tidak ada akses ke PT. SOS</h1>
          <p className="mt-2 text-sm text-ink-2">
            User <b>{session.userid}</b> belum terdaftar untuk perusahaan SOS di tabel USER_PERUSAHAAN. Hubungi administrator.
          </p>
        </div>
      )}
    </Shell>
  );
}
