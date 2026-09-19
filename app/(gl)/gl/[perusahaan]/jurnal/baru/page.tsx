import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getAkunTransaksi, getCostCenters } from "@/lib/gl";
import { getGlContext, glPath } from "@/lib/gl-context";
import JurnalForm from "../jurnal-form";

export const metadata: Metadata = { title: "GL — Input Jurnal" };

const todayWib = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

export default async function JurnalBaruPage({ params }: PageProps<"/gl/[perusahaan]/jurnal/baru">) {
  const { perusahaan } = await params;
  await getGlContext(perusahaan);
  const [akunList, ccList] = await Promise.all([getAkunTransaksi(perusahaan), getCostCenters(perusahaan)]);
  const base = glPath(perusahaan, "/jurnal");

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={base} className="mb-4 inline-block text-sm text-accent-ink hover:underline">
        ← Daftar jurnal
      </Link>
      <PageHeader title="Input Jurnal" description="Jurnal umum baru (BMM). Hanya untuk bulan yang masih aktif." />
      <JurnalForm perusahaan={perusahaan} noRef={null} tcode={null} initial={{ tanggal: todayWib(), remarks: "", lines: [] }} akunList={akunList} ccList={ccList} batalHref={base} />
    </div>
  );
}
