import type { Metadata } from "next";
import HalamanJurnalFoto from "./halaman";

export const metadata: Metadata = { title: "GL — Jurnal dari Foto" };

export default async function JurnalFotoPage({ params, searchParams }: PageProps<"/gl/[perusahaan]/jurnal-foto">) {
  const { perusahaan } = await params;
  return <HalamanJurnalFoto perusahaan={perusahaan} asal="foto" sp={await searchParams} />;
}
