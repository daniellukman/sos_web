"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContext } from "@/lib/context";
import { FakturTidakBisaDieditError, updateFaktur } from "@/lib/faktur";

export type FakturFormState = {
  values?: { tanggal: string; keterangan: string; pctPpn: string; lines: { item: number; deskripsi: string; qty: string }[] };
  errors?: { tanggal?: string; keterangan?: string; pctPpn?: string; lines?: Record<number, string>; form?: string };
};

const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export async function saveFaktur(noRef: number, items: number[], _prev: FakturFormState, formData: FormData): Promise<FakturFormState> {
  const { session, company } = await getContext();
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const values = {
    tanggal: str("tanggal"),
    keterangan: str("keterangan"),
    pctPpn: str("pctPpn").replace(",", ".") || "0",
    lines: items.map((item) => ({ item, deskripsi: str(`deskripsi-${item}`), qty: str(`qty-${item}`) || "1" })),
  };
  if (!company) return { values, errors: { form: "User ini tidak punya akses ke PT. SOS." } };

  const errors: NonNullable<FakturFormState["errors"]> = {};
  const lineErrors: Record<number, string> = {};
  const pct = Number(values.pctPpn);
  if (!isDate(values.tanggal)) errors.tanggal = "Tanggal faktur wajib diisi.";
  if (values.keterangan.length > 200) errors.keterangan = "Maksimal 200 karakter.";
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) errors.pctPpn = "Isi 0–100.";
  for (const l of values.lines) {
    const qty = Number(l.qty);
    if (!l.deskripsi) lineErrors[l.item] = "Deskripsi wajib diisi.";
    else if (l.deskripsi.length > 2000) lineErrors[l.item] = "Deskripsi maksimal 2000 karakter.";
    else if (!Number.isInteger(qty) || qty < 1 || qty > 100000) lineErrors[l.item] = "Qty minimal 1.";
  }
  if (Object.keys(lineErrors).length) errors.lines = lineErrors;
  if (Object.keys(errors).length) return { values, errors };

  try {
    await updateFaktur(
      noRef,
      {
        tanggal: values.tanggal,
        keterangan: values.keterangan,
        pctPpn: pct,
        lines: values.lines.map((l) => ({ item: l.item, deskripsi: l.deskripsi, qty: Number(l.qty) })),
      },
      session.userid,
    );
  } catch (err) {
    if (err instanceof FakturTidakBisaDieditError) return { values, errors: { form: err.message } };
    console.error("Simpan invoice gagal:", err);
    return { values, errors: { form: "Gagal menyimpan ke database. Coba lagi." } };
  }

  revalidatePath("/faktur");
  redirect(`/faktur/${noRef}?saved=1`);
}
