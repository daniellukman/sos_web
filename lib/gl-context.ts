import "server-only";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { Company } from "@/lib/company";
import type { GlPeriode } from "@/lib/gl";
import { getContext } from "@/lib/context";

export const glPath = (perusahaan: string, sub = "") => `/gl/${encodeURIComponent(perusahaan)}${sub}`;

/** Link ke buku besar satu akun untuk periode tertentu. */
export const bukuBesarPath = (perusahaan: string, akun: string, periode: GlPeriode) =>
  glPath(perusahaan, `/buku-besar?akun=${encodeURIComponent(akun)}&tahun=${periode.tahun}&dari=${periode.dari}&sampai=${periode.sampai}`);

/** Sesi + perusahaan GL yang sedang dibuka; 404 jika user tidak terdaftar untuk perusahaan itu di USER_PERUSAHAAN. */
export const getGlContext = cache(async (perusahaan: string) => {
  const { session, companies } = await getContext();
  const company = companies.find((c) => c.kode === perusahaan);
  if (!company) notFound();
  return { session, company, companies };
});

/** Perusahaan lain milik user (sumber copy jurnal). */
export const otherCompanies = (companies: Company[], perusahaan: string) => companies.filter((c) => c.kode !== perusahaan);
