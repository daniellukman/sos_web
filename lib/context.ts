import "server-only";
import { cache } from "react";
import { requireSession } from "@/lib/auth";
import { getCompany, getUserCompanies } from "@/lib/company";

/**
 * Sesi + perusahaan, di-cache per request.
 * `company` = PT. SOS (null jika user tidak punya akses), `companies` = semua perusahaan user (untuk menu GL).
 */
export const getContext = cache(async () => {
  const session = await requireSession();
  const [company, companies] = await Promise.all([getCompany(session.userid), getUserCompanies(session.userid)]);
  return { session, company, companies };
});
