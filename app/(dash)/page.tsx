import { redirect } from "next/navigation";

// Halaman utama langsung ke menu pertama
export default function HomePage() {
  redirect("/customer");
}
