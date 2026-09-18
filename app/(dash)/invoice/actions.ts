"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/context";
import { SudahDiinvoiceError, insertInvoice, type InvoiceInput } from "@/lib/invoice";

export type InvoiceFormState = {
  values?: { tanggal: string; keterangan: string; pctPpn: string; deskripsi: string; qty: string };
  errors?: Partial<Record<"tanggal" | "keterangan" | "pctPpn" | "deskripsi" | "qty" | "form", string>>;
};

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export async function saveInvoice(
  noRefKontrak: number,
  awal: string | null,
  _prev: InvoiceFormState,
  formData: FormData,
): Promise<InvoiceFormState> {
  const { session, company } = await getContext();
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const values = {
    tanggal: str("tanggal"),
    keterangan: str("keterangan"),
    pctPpn: str("pctPpn").replace(",", ".") || "0",
    deskripsi: str("deskripsi"),
    qty: str("qty") || "1",
  };
  if (!company) return { values, errors: { form: "User ini tidak punya akses ke PT. SOS." } };

  const errors: NonNullable<InvoiceFormState["errors"]> = {};
  const pct = Number(values.pctPpn);
  const qty = Number(values.qty);
  if (!isDate(values.tanggal)) errors.tanggal = "Tanggal faktur wajib diisi.";
  if (values.keterangan.length > 200) errors.keterangan = "Maksimal 200 karakter.";
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) errors.pctPpn = "Isi 0–100.";
  if (!values.deskripsi) errors.deskripsi = "Deskripsi wajib diisi.";
  else if (values.deskripsi.length > 2000) errors.deskripsi = "Maksimal 2000 karakter.";
  if (!Number.isInteger(qty) || qty < 1 || qty > 100000) errors.qty = "Qty minimal 1.";
  if (Object.keys(errors).length) return { values, errors };

  const data: InvoiceInput = { tanggal: values.tanggal, keterangan: values.keterangan, pctPpn: pct, deskripsi: values.deskripsi, qty };
  let hasil: { noRef: number; noFaktur: string };
  try {
    hasil = await insertInvoice(noRefKontrak, awal, data, session.userid);
  } catch (err) {
    if (err instanceof SudahDiinvoiceError) return { values, errors: { form: err.message } };
    console.error("Simpan invoice gagal:", err);
    return { values, errors: { form: "Gagal menyimpan ke database. Coba lagi." } };
  }

  revalidatePath("/invoice");
  revalidatePath("/faktur");
  redirect(`/invoice?saved=${encodeURIComponent(hasil.noFaktur)}&ref=${hasil.noRef}`);
}
