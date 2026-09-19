import { redirect } from "next/navigation";
import { getGlContext, glPath } from "@/lib/gl-context";

export default async function GlCompanyPage({ params }: PageProps<"/gl/[perusahaan]">) {
  const { perusahaan } = await params;
  await getGlContext(perusahaan);
  redirect(glPath(perusahaan, "/neraca-saldo"));
}
