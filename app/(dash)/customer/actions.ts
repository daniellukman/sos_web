"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/context";
import {
  CUSTOMER_FIELDS,
  FLAG_FIELDS,
  insertCustomer,
  updateCustomer,
  type CustomerInput,
  type CustomerTextField,
} from "@/lib/customers";

export type CustomerFormState = {
  values?: Partial<CustomerInput>;
  errors?: Partial<Record<CustomerTextField | "form", string>>;
};

// Kolom yang disimpan huruf kapital, mengikuti data yang sudah ada
const UPPERCASE: CustomerTextField[] = ["kode", "nama", "namaPpn"];

function parse(formData: FormData) {
  const values = {} as CustomerInput;
  const errors: CustomerFormState["errors"] = {};

  for (const [k, f] of Object.entries(CUSTOMER_FIELDS) as [CustomerTextField, { max: number }][]) {
    let v = String(formData.get(k) ?? "").trim().replace(/\s+/g, " ");
    if (UPPERCASE.includes(k)) v = v.toUpperCase();
    values[k] = v;
    if (v.length > f.max) errors[k] = `Maksimal ${f.max} karakter.`;
  }
  for (const k of FLAG_FIELDS) values[k] = formData.get(k) === "on";

  if (!values.kode) errors.kode = "Kode wajib diisi.";
  else if (!/^[A-Z0-9._-]+$/.test(values.kode)) errors.kode = "Hanya huruf, angka, titik, - dan _.";
  if (!values.nama) errors.nama = "Nama wajib diisi.";
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = "Format email tidak valid.";
  if (values.npwp && !/^[0-9.\-\s]+$/.test(values.npwp)) errors.npwp = "NPWP hanya berisi angka.";
  if (!FLAG_FIELDS.slice(1).some((k) => values[k])) errors.form = "Pilih minimal satu jenis (Customer/Supplier/Mitra/Sales).";

  return { values, errors };
}

export async function saveCustomer(
  mode: "create" | "edit",
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const { session, company } = await getContext();
  const { values, errors } = parse(formData);
  if (!company) return { values, errors: { form: "User ini tidak punya akses ke PT. SOS." } };
  if (Object.keys(errors).length) return { values, errors };

  try {
    if (mode === "create") {
      await insertCustomer(values, session.userid);
    } else if (!(await updateCustomer(values, session.userid))) {
      return { values, errors: { form: "Customer tidak ditemukan, mungkin sudah dihapus." } };
    }
  } catch (err) {
    // 2627/2601 = pelanggaran primary key / unique
    const number = (err as { number?: number }).number;
    if (number === 2627 || number === 2601) {
      return { values, errors: { kode: `Kode ${values.kode} sudah dipakai.` } };
    }
    console.error("Simpan customer gagal:", err);
    return { values, errors: { form: "Gagal menyimpan ke database. Coba lagi." } };
  }

  revalidatePath("/customer");
  redirect(`/customer?q=${encodeURIComponent(values.kode)}&saved=${mode}`);
}
