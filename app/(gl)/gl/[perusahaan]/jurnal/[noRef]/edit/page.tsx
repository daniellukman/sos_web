import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getAkunTransaksi, getCostCenters, getJurnal, isPeriodeAktif } from "@/lib/gl";
import { getGlContext, glPath } from "@/lib/gl-context";
import { JENIS_INPUT } from "@/lib/gl-jurnal";
import { formatAngka } from "@/lib/rupiah";
import JurnalForm from "../../jurnal-form";

export const metadata: Metadata = { title: "GL — Edit Jurnal" };

export default async function JurnalEditPage({ params }: PageProps<"/gl/[perusahaan]/jurnal/[noRef]/edit">) {
  const { perusahaan, noRef: raw } = await params;
  await getGlContext(perusahaan);
  const noRef = Number(raw);
  if (!Number.isInteger(noRef)) notFound();
  const j = await getJurnal(perusahaan, noRef);
  if (!j) notFound();
  const detailHref = glPath(perusahaan, `/jurnal/${noRef}`);
  if (j.jenis !== JENIS_INPUT || !(await isPeriodeAktif(perusahaan, j.tanggal))) redirect(`${detailHref}?err=periode`);

  const [akunList, ccList] = await Promise.all([getAkunTransaksi(perusahaan), getCostCenters(perusahaan)]);
  const initial = {
    tanggal: j.tanggal,
    remarks: j.remarks,
    lines: j.lines.map((l) => ({ akun: l.akun, keterangan: l.keterangan, cc: l.cc, debet: formatAngka(l.debet), kredit: formatAngka(l.kredit) })),
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={detailHref} className="mb-4 inline-block text-sm text-accent-ink hover:underline">
        ← Kembali ke jurnal
      </Link>
      <PageHeader title={`Edit Jurnal ${j.tcode}`} description={`No. Ref ${noRef}`} />
      <JurnalForm perusahaan={perusahaan} noRef={noRef} tcode={j.tcode} initial={initial} akunList={akunList} ccList={ccList} batalHref={detailHref} />
    </div>
  );
}
