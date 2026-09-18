import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { buatExcel, responseExcel, tanggalExcel, waktuExport } from "@/lib/excel";
import { labelJadwal } from "@/lib/invoice-text";
import { getKontrakList, parseKontrakFilter, type KontrakRow } from "@/lib/kontrak";

const STATUS_FILTER: Record<string, string> = {
  berjalan: "Berulang — berjalan",
  selesai: "Berulang — selesai",
  sekali: "Invoice 1 kali",
};

const status = (k: KontrakRow) => (!k.recurring ? "-" : k.selesai === 1 ? "Selesai" : "Berjalan");

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("Silakan login.", { status: 401 });
  if (!(await getCompany(session.userid))) return new Response("Tidak ada akses.", { status: 403 });

  // Filter sama persis dengan yang sedang tampil di halaman Kontrak
  const filter = parseKontrakFilter((k) => request.nextUrl.searchParams.get(k));
  const rows = await getKontrakList(filter);

  const buffer = await buatExcel<KontrakRow>({
    sheet: "Kontrak",
    judul: "Daftar Kontrak PT. SOS",
    keterangan: [
      filter.status ? `Status: ${STATUS_FILTER[filter.status]}` : "Semua kontrak",
      ...(filter.q ? [`Cari: "${filter.q}"`] : []),
      waktuExport(session.userid),
    ],
    labelTotal: `Total (${rows.length} kontrak)`,
    rows,
    columns: [
      { header: "No. Kontrak", width: 14, value: (k) => k.noKontrak || `#${k.noRef}` },
      { header: "Tanggal", width: 13, value: (k) => tanggalExcel(k.tanggal), format: "tanggal" },
      { header: "Kode Customer", width: 14, value: (k) => k.customer ?? "" },
      { header: "Nama Customer", width: 34, value: (k) => k.customerNama ?? "" },
      { header: "Bidang Usaha", width: 22, value: (k) => k.lobNama ?? k.lob ?? "" },
      { header: "Deskripsi Kontrak", width: 40, value: (k) => k.deskripsi ?? "" },
      { header: "Nilai Invoice", width: 16, value: (k) => k.nilaiInvoice, format: "rupiah", total: true },
      {
        header: "Penagihan",
        width: 16,
        value: (k) => labelJadwal({ recurring: k.recurring === 1, periode: k.periode, periodeValue: k.periodeValue }),
      },
      { header: "Tgl Awal Invoice", width: 16, value: (k) => (k.recurring ? tanggalExcel(k.tanggalAwal) : null), format: "tanggal" },
      { header: "Status", width: 12, value: status },
      { header: "Tgl Selesai", width: 13, value: (k) => (k.selesai === 1 ? tanggalExcel(k.selesaiTanggal) : null), format: "tanggal" },
      { header: "Alasan Selesai", width: 30, value: (k) => (k.selesai === 1 ? (k.selesaiDeskripsi ?? "") : "") },
    ],
  });

  return responseExcel(buffer, "Daftar-Kontrak-SOS");
}
