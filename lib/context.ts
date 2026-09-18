import "server-only";
import { cache } from "react";
import { requireSession } from "@/lib/auth";
import { getCompany } from "@/lib/company";

/** Sesi + perusahaan (PT. SOS, atau null jika user tidak punya akses), di-cache per request. */
export const getContext = cache(async () => {
  const session = await requireSession();
  const company = await getCompany(session.userid);
  return { session, company };
});
