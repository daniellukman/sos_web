import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { getContext } from "@/lib/context";
import { suggestKode } from "@/lib/customers";
import CustomerForm from "../customer-form";

export const metadata: Metadata = { title: "Tambah Customer" };

export default async function NewCustomerPage() {
  await getContext();
  const kode = await suggestKode();

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/customer" className="mb-4 inline-block text-sm text-accent-ink hover:underline">
        ← Kembali ke daftar
      </Link>
      <PageHeader title="Tambah Customer" description={`Kode disarankan ${kode}, boleh diubah.`} />
      <CustomerForm
        mode="create"
        initial={{
          kode,
          nama: "",
          affiliasi: "",
          npwp: "",
          noKtp: "",
          telp: "",
          email: "",
          fax: "",
          contact: "",
          namaPpn: "",
          alamatPpn1: "",
          alamatPpn2: "",
          alamatPpn3: "",
          bank: "",
          noRekening: "",
          namaRekening: "",
          pkp: true,
          flagCustomer: true,
          flagSupplier: false,
          flagMitra: false,
          flagSales: false,
        }}
      />
    </div>
  );
}
