import { PageHeader } from "@/components/ui";
import { NAMA_BULAN, getAkunTransaksi, getGlTahun, getImportDefault } from "@/lib/gl";
import { getGlContext } from "@/lib/gl-context";
import { ambilDraft, daftarDraft, type DraftAsal } from "@/lib/gl-foto-draft";
import { formatAngka } from "@/lib/rupiah";
import BacaForm from "./baca-form";
import DraftForm, { type DraftRow } from "./draft-form";

const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");
const bln = (m: number) => String(m).padStart(2, "0");

const TEKS: Record<DraftAsal, { judul: string; deskripsi: string }> = {
  foto: { judul: "Jurnal dari Foto", deskripsi: "Buat jurnal biaya dari file foto bon/bill/invoice. Tanggal dan nilai dibaca otomatis, lalu Anda periksa sebelum disimpan." },
  kamera: { judul: "Jurnal dari Kamera", deskripsi: "Potret bon/bill/invoice langsung dengan kamera. Tanggal dan nilai dibaca otomatis, lalu Anda periksa sebelum disimpan." },
};

type Props = { perusahaan: string; asal: DraftAsal; sp: Record<string, string | string[] | undefined> };

/** Halaman bersama "Jurnal dari Foto" dan "Jurnal dari Kamera": form baca gambar, atau tabel draft jika ada. */
export default async function HalamanJurnalFoto({ perusahaan, asal, sp }: Props) {
  const { session } = await getGlContext(perusahaan);
  const { judul, deskripsi } = TEKS[asal];

  // Draft yang diminta lewat URL, atau draft terakhir milik user di menu ini yang belum diproses
  const draft = (str(sp.draft) && ambilDraft(str(sp.draft), perusahaan, session.userid)) || daftarDraft(perusahaan, session.userid, asal)[0] || null;
  const akunList = await getAkunTransaksi(perusahaan);

  if (draft) {
    const label = `${NAMA_BULAN[draft.bulan - 1]} ${draft.tahun}`;
    const hariTerakhir = new Date(Date.UTC(draft.tahun, draft.bulan, 0)).getUTCDate();
    const rows: DraftRow[] = draft.items.map((it) => ({
      item: it.item,
      fileName: it.fileName,
      status: it.status,
      pesan: it.pesan,
      tanggalFoto: it.tanggalFoto,
      tdate: it.tdate,
      remarks: it.remarks,
      ref1: it.ref1,
      akunDebet: it.akunDebet,
      akunKredit: it.akunKredit,
      nilai: formatAngka(it.nilai),
      fotoUrl: `/api/gl-foto-draft/${encodeURIComponent(perusahaan)}/${draft.id}/${it.item}`,
    }));
    return (
      <>
        <PageHeader title={judul} description={`Hasil baca ${draft.items.length} foto untuk ${label}. Periksa dan ubah bila perlu, lalu proses jadi jurnal.`} />
        <DraftForm
          perusahaan={perusahaan}
          draftId={draft.id}
          label={label}
          rows={rows}
          akunList={akunList}
          min={`${draft.tahun}-${bln(draft.bulan)}-01`}
          max={`${draft.tahun}-${bln(draft.bulan)}-${bln(hariTerakhir)}`}
        />
      </>
    );
  }

  const [tahunList, def] = await Promise.all([getGlTahun(perusahaan), getImportDefault(perusahaan)]);
  const now = new Date();
  const tahun = tahunList.includes(now.getFullYear()) ? now.getFullYear() : tahunList[0];

  return (
    <>
      <PageHeader title={judul} description={deskripsi} />
      {str(sp.batal) === "1" && (
        <p role="status" className="mb-4 rounded-lg bg-surface-2 px-4 py-3 text-sm text-ink-2">
          Draft dibatalkan, tidak ada jurnal yang dibuat.
        </p>
      )}
      {!process.env.ANTHROPIC_API_KEY && (
        <p role="alert" className="mb-4 rounded-lg bg-warn-bg px-4 py-3 text-sm text-warn-ink">
          ANTHROPIC_API_KEY belum diisi di .env.local — foto belum bisa dibaca.
        </p>
      )}
      <BacaForm
        perusahaan={perusahaan}
        asal={asal}
        tahunList={tahunList}
        namaBulan={NAMA_BULAN}
        akunList={akunList}
        initial={{ tahun, bulan: now.getMonth() + 1, akunDebet: def.debet, akunKredit: def.kredit }}
      />
    </>
  );
}
