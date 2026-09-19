import Shell from "@/components/shell";
import { getContext } from "@/lib/context";

/** Halaman milik user (mis. ganti password): cukup login, tidak butuh akses perusahaan tertentu. */
export default async function AkunLayout({ children }: LayoutProps<"/">) {
  const { session, company, companies } = await getContext();
  return (
    <Shell session={session} hasSos={!!company} companies={companies} title="Akun">
      {children}
    </Shell>
  );
}
