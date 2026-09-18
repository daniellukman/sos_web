"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/context";
import {
  KONTRAK_MAX,
  PERIODE,
  existsCustomer,
  existsLob,
  insertKontrak,
  updateKontrak,
  type KontrakInput,
  type Periode,
} from "@/lib/kontrak";

export type KontrakFormState = {
  values?: KontrakInput;
  errors?: Partial<Record<keyof KontrakInput | "form", string>>;
};

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** "1.500.000" / "1.500.000,50" / "1500000" -> angka (format Indonesia). */
function parseRupiah(raw: string): number {
  let s = raw.replace(/[^\d.,-]/g, "");
  s = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/\./g, "");
  return s === "" ? NaN : Number(s);
}

function parse(formData: FormData) {
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const periode = str("recurringPeriode");
  const values: KontrakInput = {
    tanggal: str("tanggal"),
    customer: str("customer"),
    lob: str("lob"),
    deskripsi: str("deskripsi"),
    nilaiInvoice: parseRupiah(str("nilaiInvoice")),
    recurring: formData.get("recurring") === "1",
    recurringTanggalAwal: str("recurringTanggalAwal"),
    recurringPeriode: (PERIODE as readonly string[]).includes(periode) ? (periode as Periode) : "BULAN",
    recurringPeriodeValue: Number(str("recurringPeriodeValue") || 1),
    selesai: formData.get("selesai") === "1",
    selesaiTanggal: str("selesaiTanggal"),
    selesaiDeskripsi: str("selesaiDeskripsi"),
  };

  const errors: KontrakFormState["errors"] = {};
  if (!isDate(values.tanggal)) errors.tanggal = "Tanggal kontrak wajib diisi.";
  if (!values.customer) errors.customer = "Pilih customer.";
  if (!values.lob) errors.lob = "Pilih bidang usaha.";
  if (values.deskripsi.length > KONTRAK_MAX.deskripsi) errors.deskripsi = `Maksimal ${KONTRAK_MAX.deskripsi} karakter.`;
  if (!Number.isFinite(values.nilaiInvoice) || values.nilaiInvoice < 0) errors.nilaiInvoice = "Isi nilai invoice yang valid.";
  else if (values.nilaiInvoice >= 1e16) errors.nilaiInvoice = "Nilai terlalu besar.";

  if (values.recurring) {
    if (!isDate(values.recurringTanggalAwal)) errors.recurringTanggalAwal = "Tanggal awal invoice wajib diisi.";
    if (!Number.isInteger(values.recurringPeriodeValue) || values.recurringPeriodeValue < 1 || values.recurringPeriodeValue > 999)
      errors.recurringPeriodeValue = "Isi angka 1–999.";

    if (values.selesai) {
      if (!isDate(values.selesaiTanggal)) errors.selesaiTanggal = "Tanggal selesai wajib diisi.";
      else if (isDate(values.tanggal) && values.selesaiTanggal < values.tanggal)
        errors.selesaiTanggal = "Tidak boleh sebelum tanggal kontrak.";
      if (!values.selesaiDeskripsi) errors.selesaiDeskripsi = "Alasan kontrak selesai wajib diisi.";
      else if (values.selesaiDeskripsi.length > KONTRAK_MAX.selesaiDeskripsi)
        errors.selesaiDeskripsi = `Maksimal ${KONTRAK_MAX.selesaiDeskripsi} karakter.`;
    }
  }
  return { values, errors };
}

export async function saveKontrak(
  noRef: number | null,
  _prev: KontrakFormState,
  formData: FormData,
): Promise<KontrakFormState> {
  const { session, company } = await getContext();
  const { values, errors } = parse(formData);
  if (!company) return { values, errors: { form: "User ini tidak punya akses ke PT. SOS." } };

  try {
    if (values.customer && !errors.customer && !(await existsCustomer(values.customer)))
      errors.customer = "Customer tidak ditemukan.";
    if (values.lob && !errors.lob && !(await existsLob(values.lob))) errors.lob = "Bidang usaha tidak ditemukan.";
    if (Object.keys(errors).length) return { values, errors };

    if (noRef === null) {
      noRef = (await insertKontrak(values, session.userid)).noRef;
    } else if (!(await updateKontrak(noRef, values, session.userid))) {
      return { values, errors: { form: "Kontrak tidak ditemukan, mungkin sudah dihapus." } };
    }
  } catch (err) {
    console.error("Simpan kontrak gagal:", err);
    return { values, errors: { form: "Gagal menyimpan ke database. Coba lagi." } };
  }

  revalidatePath("/kontrak");
  redirect(`/kontrak/${noRef}?saved=1`);
}
