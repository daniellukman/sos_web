import { redirect } from "next/navigation";
import { getContext } from "@/lib/context";
import { glPath } from "@/lib/gl-context";

// /gl langsung ke perusahaan pertama milik user
export default async function GlIndexPage() {
  const { companies } = await getContext();
  if (companies[0]) redirect(glPath(companies[0].kode));
  return null;
}
