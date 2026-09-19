import { getGlContext } from "@/lib/gl-context";
import GlTabs from "./gl-tabs";

export default async function GlCompanyLayout({ params, children }: LayoutProps<"/gl/[perusahaan]">) {
  const { perusahaan } = await params;
  const { company } = await getGlContext(perusahaan);

  return (
    <>
      <div className="mb-5 space-y-4 border-b border-line pb-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted uppercase">General Ledger</p>
          <h1 className="text-xl font-semibold tracking-tight">
            {company.nama} <span className="text-base font-normal text-muted">({company.kode})</span>
          </h1>
        </div>
        <GlTabs perusahaan={company.kode} />
      </div>
      {children}
    </>
  );
}
