"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { NAMA_BULAN, getAkunTransaksi, isPeriodeAktif } from "@/lib/gl";
import { getGlContext, glPath } from "@/lib/gl-context";
import { FOTO_MAX_TOTAL, checkFoto, extOf, formatBytes, isGambar } from "@/lib/gl-foto";
import { bacaBanyakFoto } from "@/lib/gl-foto-baca";
import { ambilDraft, draftPath, hapusDraft, simpanDraft, type DraftAsal, type DraftItem } from "@/lib/gl-foto-draft";
import { insertJurnal } from "@/lib/gl-jurnal";
import { parseRupiah } from "@/lib/rupiah";

export type BacaFormState = { error?: string; values?: { tahun: string; bulan: string; akunDebet: string; akunKredit: string } };

const MAX_FOTO = 50;
const bln = (m: number) => String(m).padStart(2, "0");
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

/** Tanggal acak (hari 1..akhir bulan) di bulan yang dipilih. */
function tanggalAcak(tahun: number, bulan: number) {
  const hariTerakhir = new Date(Date.UTC(tahun, bulan, 0)).getUTCDate();
  const hari = 1 + Math.floor(Math.random() * hariTerakhir);
  return `${tahun}-${bln(bulan)}-${bln(hari)}`;
}

/** Langkah 1: baca semua foto dan simpan hasilnya sebagai draft di memori server. */
export async function bacaFotoAction(perusahaan: string, _prev: BacaFormState, formData: FormData): Promise<BacaFormState> {
  const mulai = Date.now();
  const log = (tahap: string) => console.log(`[jurnal-foto] ${perusahaan} ${tahap} (${Date.now() - mulai} ms)`);
  log("diterima");
  const { session } = await getGlContext(perusahaan);
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const values = { tahun: str("tahun"), bulan: str("bulan"), akunDebet: str("akunDebet"), akunKredit: str("akunKredit") };
  const asal: DraftAsal = str("asal") === "kamera" ? "kamera" : "foto";
  const tahun = Number(values.tahun);
  const bulan = Number(values.bulan);
  if (!Number.isInteger(tahun) || tahun < 2000 || tahun > 2100 || !(bulan >= 1 && bulan <= 12)) return { error: "Pilih bulan dan tahun.", values };

  const akunSet = new Set((await getAkunTransaksi(perusahaan)).map((a) => a.akun));
  if (!akunSet.has(values.akunDebet)) return { error: "Pilih account debet yang valid.", values };
  if (!akunSet.has(values.akunKredit)) return { error: "Pilih account credit yang valid.", values };
  if (values.akunDebet === values.akunKredit) return { error: "Account debet dan credit tidak boleh sama.", values };
  if (!(await isPeriodeAktif(perusahaan, `${tahun}-${bln(bulan)}-01`)))
    return { error: `Periode ${NAMA_BULAN[bulan - 1]} ${tahun} tidak aktif (SETUPBULAN), jurnal tidak bisa dibuat.`, values };

  const files = formData
    .getAll("fotos")
    .filter((f): f is File => f instanceof File && !(f.size === 0 && (f.name === "" || f.name === "blob")));
  if (!files.length) return { error: "Pilih minimal satu foto.", values };
  if (files.length > MAX_FOTO) return { error: `Maksimal ${MAX_FOTO} foto sekali proses.`, values };
  const problems = files.map((f) => [f.name, checkFoto(f)] as const).filter(([, e]) => e);
  if (problems.length) return { error: problems.map(([n, e]) => `${n}: ${e}`).join(" "), values };
  const bukanGambar = files.filter((f) => !isGambar(extOf(f.name)));
  if (bukanGambar.length) return { error: `Hanya foto jpg/png yang bisa dibaca: ${bukanGambar.map((f) => f.name).join(", ")}`, values };
  if (files.reduce((s, f) => s + f.size, 0) > FOTO_MAX_TOTAL) return { error: `Total ukuran foto maksimal ${formatBytes(FOTO_MAX_TOTAL)}.`, values };

  const fotos = await Promise.all(files.map(async (f) => ({ ext: extOf(f.name), bytes: Buffer.from(await f.arrayBuffer()) })));
  log(`validasi selesai, membaca ${fotos.length} foto (${fotos.map((f) => Math.round(f.bytes.length / 1024) + " KB").join(", ")})`);
  const hasil = await bacaBanyakFoto(fotos);
  log(`selesai membaca: ${hasil.map((h) => (h.ok ? "ok" : `gagal: ${h.pesan}`)).join("; ")}`);
  const awalBulan = `${tahun}-${bln(bulan)}`;

  const items: DraftItem[] = hasil.map((h, i) => {
    const dasar = {
      item: i + 1,
      fileName: files[i].name,
      ext: fotos[i].ext,
      bytes: fotos[i].bytes,
      akunDebet: values.akunDebet,
      akunKredit: values.akunKredit,
    };
    if (!h.ok) return { ...dasar, status: "gagal", pesan: h.pesan, tanggalFoto: "", tdate: tanggalAcak(tahun, bulan), remarks: "", ref1: "", nilai: 0 };
    const tanggalFoto = h.hasil.tanggal && isDate(h.hasil.tanggal) ? h.hasil.tanggal : "";
    // Tanggal dipakai hanya jika masih dalam bulan yang dipilih; jika tidak, pakai tanggal acak di bulan itu
    const dalamPeriode = tanggalFoto.startsWith(awalBulan);
    const nilai = h.hasil.nilai !== null && Number.isFinite(h.hasil.nilai) && h.hasil.nilai > 0 ? Math.round(h.hasil.nilai * 100) / 100 : 0;
    const pesan = [!tanggalFoto ? "tanggal tidak terbaca" : !dalamPeriode ? `tanggal di foto ${tanggalFoto} di luar periode` : "", !nilai ? "nilai tidak terbaca" : "", !h.hasil.yakin ? "model tidak yakin" : ""]
      .filter(Boolean)
      .join(", ");
    return {
      ...dasar,
      status: !nilai ? "gagal" : dalamPeriode ? "ok" : "tanggal_acak",
      pesan,
      tanggalFoto,
      tdate: dalamPeriode ? tanggalFoto : tanggalAcak(tahun, bulan),
      remarks: (h.hasil.merchant ?? "").slice(0, 100),
      ref1: (h.hasil.keterangan ?? "").slice(0, 100),
      nilai,
    };
  });

  const draft = simpanDraft({ asal, perusahaan, userid: session.userid, tahun, bulan, akunDebet: values.akunDebet, akunKredit: values.akunKredit, items });
  log(`draft ${draft.id} disimpan, redirect`);
  redirect(glPath(perusahaan, `${draftPath(asal)}?draft=${draft.id}`));
}

export type DraftFormState = { error?: string; saved?: boolean; baris?: Record<number, string> };

/**
 * Langkah 2: simpan perubahan user ke draft (mode "simpan"), atau simpan lalu proses semua item
 * menjadi jurnal TRNHDR/TRNDTL + foto ke DOC (mode "proses"). Nomor jurnal dibuat saat proses.
 */
export async function draftAction(perusahaan: string, draftId: string, _prev: DraftFormState, formData: FormData): Promise<DraftFormState> {
  const { session } = await getGlContext(perusahaan);
  const draft = ambilDraft(draftId, perusahaan, session.userid);
  if (!draft) return { error: "Draft tidak ditemukan atau sudah kedaluwarsa. Ulangi baca foto." };
  const mode = String(formData.get("mode") ?? "simpan");

  if (mode === "batal") {
    hapusDraft(draft.id);
    redirect(glPath(perusahaan, `${draftPath(draft.asal)}?batal=1`));
  }

  // Terapkan isian user ke draft; baris yang dicentang "hapus" dibuang
  const str = (k: string) => String(formData.get(k) ?? "").trim();
  const hapus = new Set(formData.getAll("hapus").map(Number));
  draft.items = draft.items.filter((it) => !hapus.has(it.item));
  for (const it of draft.items) {
    it.tdate = str(`tdate_${it.item}`);
    it.remarks = str(`remarks_${it.item}`).slice(0, 100);
    it.ref1 = str(`ref1_${it.item}`).slice(0, 100);
    it.akunDebet = str(`debet_${it.item}`);
    it.akunKredit = str(`kredit_${it.item}`);
    const n = parseRupiah(str(`nilai_${it.item}`));
    it.nilai = Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
  }
  if (mode !== "proses") return { saved: true };

  if (!draft.items.length) return { error: "Tidak ada jurnal untuk diproses." };
  const akunSet = new Set((await getAkunTransaksi(perusahaan)).map((a) => a.akun));
  const awalBulan = `${draft.tahun}-${bln(draft.bulan)}`;
  const baris: Record<number, string> = {};
  for (const it of draft.items) {
    const masalah: string[] = [];
    if (!isDate(it.tdate)) masalah.push("tanggal tidak valid");
    else if (!it.tdate.startsWith(awalBulan)) masalah.push(`tanggal harus di ${NAMA_BULAN[draft.bulan - 1]} ${draft.tahun}`);
    if (!(it.nilai > 0)) masalah.push("nilai harus lebih dari 0");
    if (it.nilai >= 1e16) masalah.push("nilai terlalu besar");
    if (!akunSet.has(it.akunDebet)) masalah.push("account debet tidak valid");
    if (!akunSet.has(it.akunKredit)) masalah.push("account credit tidak valid");
    if (it.akunDebet === it.akunKredit) masalah.push("account debet dan credit sama");
    if (masalah.length) baris[it.item] = masalah.join(", ");
  }
  if (Object.keys(baris).length) return { error: "Ada baris yang belum valid, perbaiki dulu.", baris };
  if (!(await isPeriodeAktif(perusahaan, `${awalBulan}-01`))) return { error: `Periode ${NAMA_BULAN[draft.bulan - 1]} ${draft.tahun} sudah tidak aktif.` };

  // Tiap item jadi satu jurnal: baris 1 debet (CC '00'), baris 2 kredit (CC kosong); fotonya ikut ke DOC
  const selesai: number[] = [];
  try {
    for (const it of draft.items) {
      const noRef = await insertJurnal(
        perusahaan,
        {
          tanggal: it.tdate,
          remarks: it.remarks,
          lines: [
            { akun: it.akunDebet, keterangan: it.ref1, cc: "00", debet: it.nilai, kredit: 0 },
            { akun: it.akunKredit, keterangan: it.ref1, cc: "", debet: 0, kredit: it.nilai },
          ],
        },
        [{ ext: it.ext, bytes: it.bytes }],
        session.userid,
      );
      selesai.push(noRef);
      // Item yang sudah jadi jurnal dikeluarkan dari draft agar tidak dobel jika proses terhenti di tengah
      draft.items = draft.items.filter((x) => x.item !== it.item);
    }
  } catch (err) {
    console.error("Proses jurnal dari foto gagal:", err);
    return { error: `Gagal menyimpan ke database setelah ${selesai.length} jurnal tersimpan. Sisa draft masih ada, coba proses lagi.` };
  }

  hapusDraft(draft.id);
  revalidatePath(glPath(perusahaan, "/jurnal"));
  redirect(glPath(perusahaan, `/jurnal?copied=${selesai.length}&tahun=${draft.tahun}&dari=${draft.bulan}&sampai=${draft.bulan}`));
}
