import type { Metadata } from "next";
import HalamanJurnalFoto from "../jurnal-foto/halaman";

export const metadata: Metadata = { title: "GL — Jurnal dari Kamera" };

export default async function JurnalKameraPage({ params, searchParams }: PageProps<"/gl/[perusahaan]/jurnal-kamera">) {
  const { perusahaan } = await params;
  return <HalamanJurnalFoto perusahaan={perusahaan} asal="kamera" sp={await searchParams} />;
}
