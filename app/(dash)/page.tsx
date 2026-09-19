import { redirect } from "next/navigation";
import { getContext } from "@/lib/context";
import { glPath } from "@/lib/gl-context";

// Halaman utama langsung ke menu pertama yang bisa diakses user
export default async function HomePage() {
  const { company, companies } = await getContext();
  if (company) redirect("/customer");
  if (companies[0]) redirect(glPath(companies[0].kode));
  redirect("/customer");
}
