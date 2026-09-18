import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { getContext } from "@/lib/context";
import { getCustomer } from "@/lib/customers";
import CustomerForm from "../customer-form";

export const metadata: Metadata = { title: "Edit Customer" };

export default async function EditCustomerPage({ params }: PageProps<"/customer/[kode]">) {
  await getContext();
  const kode = decodeURIComponent((await params).kode);
  const customer = await getCustomer(kode);
  if (!customer) notFound();

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/customer" className="mb-4 inline-block text-sm text-accent-ink hover:underline">
        ← Kembali ke daftar
      </Link>
      <PageHeader title={customer.nama} description={`Edit customer ${customer.kode}`} />
      <CustomerForm mode="edit" initial={customer} />
    </div>
  );
}
