import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getCompany } from "@/lib/company";
import { buatExcel, responseExcel, tanggalExcel, waktuExport } from "@/lib/excel";
import { getFakturList, parseFakturFilter, type FakturRow, type StatusBayar } from "@/lib/faktur";
import { formatTanggal } from "@/lib/format";

const STATUS_LABEL: Record<StatusBayar, string> = { lunas: "Lunas", sebagian: "Dibayar sebagian", belum: "Belum dibayar" };
const sisa = (f: FakturRow) => (f.status === "lunas" ? 0 : f.nilaiAkhir - f.nilaiDibayar);

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("Silakan login.", { status: 401 });
  if (!(await getCompany(session.userid))) return new Response("Tidak ada akses.", { status: 403 });

  // Filter sama persis dengan yang sedang tampil di halaman Daftar Invoice
  const filter = parseFakturFilter((k) => request.nextUrl.searchParams.get(k));
  const rows = await getFakturList(filter);

  const buffer = await buatExcel<FakturRow>({
    sheet: "Invoice",
    judul: "Daftar Invoice PT. SOS",
    keterangan: [
      filter.dari || filter.sampai
        ? `Tanggal ${filter.dari ? formatTanggal(filter.dari) : "…"} s/d ${filter.sampai ? formatTanggal(filter.sampai) : "…"}`
        : "Semua tanggal",
      ...(filter.status ? [`Status: ${STATUS_LABEL[filter.status as StatusBayar]}`] : []),
      ...(filter.q ? [`Cari: "${filter.q}"`] : []),
      waktuExport(session.userid),
    ],
    labelTotal: `Total (${rows.length} invoice)`,
    rows,
    columns: [
      { header: "No. Faktur", width: 20, value: (f) => f.noFaktur || `#${f.noRef}` },
      { header: "Tanggal", width: 13, value: (f) => tanggalExcel(f.tanggal), format: "tanggal" },
      { header: "Kode Customer", width: 14, value: (f) => f.customer },
      { header: "Nama Customer", width: 34, value: (f) => f.customerNama ?? "" },
      { header: "No. Kontrak", width: 14, value: (f) => f.noKontrak ?? "" },
      { header: "Sebelum PPN", width: 16, value: (f) => f.nilaiSebelumPpn, format: "rupiah", total: true },
      { header: "PPN", width: 14, value: (f) => f.nilaiPpn, format: "rupiah", total: true },
      { header: "Nilai Akhir", width: 16, value: (f) => f.nilaiAkhir, format: "rupiah", total: true },
      { header: "Dibayar", width: 16, value: (f) => f.nilaiDibayar, format: "rupiah", total: true },
      { header: "Sisa", width: 16, value: sisa, format: "rupiah", total: true },
      { header: "Status", width: 18, value: (f) => STATUS_LABEL[f.status] },
    ],
  });

  return responseExcel(buffer, "Daftar-Invoice-SOS");
}
