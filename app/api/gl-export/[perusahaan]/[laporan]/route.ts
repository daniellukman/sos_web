import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserCompanies } from "@/lib/company";
import { buatExcel, responseExcel, tanggalExcel, waktuExport } from "@/lib/excel";
import {
  NAMA_BULAN,
  getBukuBesarRentang,
  getGlTahun,
  getNeraca,
  getNeracaSaldo,
  getRugiLaba,
  labelBukuBesar,
  labelPeriode,
  parseBukuBesarFilter,
  parseGlBulan,
  parseGlPeriode,
  type GlPeriode,
} from "@/lib/gl";

// Nama akun diberi indentasi sesuai level agar hierarki tetap terlihat di Excel
const indent = (nama: string, level: number) => `${"   ".repeat(Math.max(0, level - 1))}${nama}`;
const aman = (s: string) => s.replace(/[^\w.-]/g, "_");

/** Export laporan GL ke Excel; filter sama persis dengan yang sedang tampil di halaman. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/gl-export/[perusahaan]/[laporan]">) {
  const session = await getSession();
  if (!session) return new Response("Silakan login.", { status: 401 });
  const { perusahaan, laporan } = await ctx.params;
  const company = (await getUserCompanies(session.userid)).find((c) => c.kode === perusahaan);
  if (!company) return new Response("Tidak ada akses.", { status: 403 });

  const get = (k: string) => request.nextUrl.searchParams.get(k);
  const tahunList = await getGlTahun(perusahaan);
  const cap = `${company.nama} (${company.kode})`;
  const info = (periode: GlPeriode, ...extra: string[]) => [labelPeriode(periode), ...extra, "Sumber: hasil posting (GLBalnc)", waktuExport(session.userid)];

  if (laporan === "neraca-saldo") {
    const periode = parseGlPeriode(get, tahunList);
    const rows = await getNeracaSaldo(perusahaan, periode);
    const detail = rows.filter((r) => !r.induk);
    const sum = (f: (r: (typeof rows)[number]) => number) => detail.reduce((s, r) => s + f(r), 0);
    const buffer = await buatExcel({
      sheet: "Neraca Saldo",
      judul: `Neraca Saldo ${cap}`,
      keterangan: info(periode, "Baris akun induk sudah berisi total sub-akunnya"),
      labelTotal: "Total",
      rows,
      columns: [
        { header: "Akun", width: 10, value: (r) => r.akun },
        { header: "Nama Akun", width: 40, value: (r) => indent(r.nama, r.level) },
        { header: "Saldo Awal", width: 18, value: (r) => r.saldoAwal, format: "rupiah" },
        { header: "Debet", width: 18, value: (r) => r.debet, format: "rupiah" },
        { header: "Kredit", width: 18, value: (r) => r.kredit, format: "rupiah" },
        { header: "Saldo Akhir", width: 18, value: (r) => r.saldoAkhir, format: "rupiah" },
      ],
      barisTotal: [{ label: `Total (${detail.length} akun)`, nilai: [null, null, sum((r) => r.saldoAwal), sum((r) => r.debet), sum((r) => r.kredit), sum((r) => r.saldoAkhir)] }],
    });
    return responseExcel(buffer, `Neraca-Saldo-${aman(perusahaan)}`);
  }

  if (laporan === "buku-besar") {
    const f = parseBukuBesarFilter(get, tahunList);
    if (!f.akunDari || !f.akunSampai) return new Response("Pilih rentang akun dulu.", { status: 400 });
    const akunList = await getBukuBesarRentang(perusahaan, f);
    // Satu tabel: tiap akun diawali baris "Saldo awal" dan diakhiri baris "Total akun"
    type Baris = { akun: string; nama: string; tanggal: string | null; tcode: string; keterangan: string; debet: number; kredit: number; saldo: number; jenis: "awal" | "trx" | "total" };
    const rows: Baris[] = akunList.flatMap((a) => [
      { akun: a.akun, nama: a.nama, tanggal: null, tcode: "", keterangan: "Saldo awal", debet: 0, kredit: 0, saldo: a.saldoAwal, jenis: "awal" as const },
      ...a.rows.map((r) => ({ akun: a.akun, nama: a.nama, tanggal: r.tanggal, tcode: r.tcode || `#${r.noRef}`, keterangan: r.keterangan, debet: r.debet, kredit: r.kredit, saldo: r.saldo, jenis: "trx" as const })),
      { akun: a.akun, nama: a.nama, tanggal: null, tcode: "Total", keterangan: `Total ${a.akun} (saldo awal ${a.saldoAwal.toLocaleString("id-ID")})`, debet: a.debet, kredit: a.kredit, saldo: a.saldoAkhir, jenis: "total" as const },
    ]);
    const buffer = await buatExcel<Baris>({
      sheet: "Buku Besar",
      judul: `Buku Besar ${cap}`,
      keterangan: [`Akun ${f.akunDari} – ${f.akunSampai}`, labelBukuBesar(f)],
      labelTotal: "Total",
      rows,
      columns: [
        { header: "Akun", width: 10, value: (r) => r.akun },
        { header: "Nama Akun", width: 32, value: (r) => r.nama },
        { header: "Tanggal", width: 13, value: (r) => tanggalExcel(r.tanggal), format: "tanggal" },
        { header: "No. Jurnal", width: 18, value: (r) => r.tcode },
        { header: "Keterangan", width: 45, value: (r) => r.keterangan },
        { header: "Debet", width: 18, value: (r) => r.debet, format: "rupiahPolos" },
        { header: "Kredit", width: 18, value: (r) => r.kredit, format: "rupiahPolos" },
        { header: "Saldo", width: 18, value: (r) => r.saldo, format: "rupiahPolos" },
      ],
      // Tanpa grand total: total per akun sudah ada di baris "Total <akun>"
      barisTotal: [],
    });
    return responseExcel(buffer, `Buku-Besar-${aman(perusahaan)}-${aman(f.akunDari)}-${aman(f.akunSampai)}`);
  }

  if (laporan === "rugi-laba") {
    const periode = parseGlBulan(get, tahunList);
    const { rows, totalPeriode, totalTahunBerjalan } = await getRugiLaba(perusahaan, periode);
    const ytd = `Jan – ${NAMA_BULAN[periode.sampai - 1]} ${periode.tahun}`;
    const buffer = await buatExcel({
      sheet: "Rugi Laba",
      judul: `Rugi Laba ${cap}`,
      keterangan: info(periode, `Nilai = ${labelPeriode(periode)}, Nilai YTD = ${ytd}`),
      labelTotal: "Laba (rugi) bersih",
      rows,
      columns: [
        { header: "Account", width: 10, value: (r) => r.akun },
        { header: "Nama Account", width: 40, value: (r) => indent(r.nama, r.level) },
        { header: "Nilai", width: 20, value: (r) => r.periode, format: "rupiah" },
        { header: "Nilai YTD", width: 20, value: (r) => r.tahunBerjalan, format: "rupiah" },
      ],
      barisTotal: [{ label: totalTahunBerjalan < 0 ? "Rugi bersih" : "Laba bersih", nilai: [null, null, totalPeriode, totalTahunBerjalan] }],
    });
    return responseExcel(buffer, `Rugi-Laba-${aman(perusahaan)}`);
  }

  if (laporan === "neraca") {
    const periode = parseGlBulan(get, tahunList);
    const n = await getNeraca(perusahaan, periode);
    type Baris = { sisi: string; akun: string; nama: string; level: number; saldo: number };
    const rows: Baris[] = [
      ...n.aktiva.map((r) => ({ sisi: "Aktiva", ...r })),
      ...n.pasiva.map((r) => ({ sisi: "Pasiva", ...r })),
      ...(n.labaBerjalan !== 0 ? [{ sisi: "Pasiva", akun: "", nama: "Laba (rugi) berjalan — belum tutup bulan", level: 1, saldo: n.labaBerjalan }] : []),
    ];
    const buffer = await buatExcel<Baris>({
      sheet: "Neraca",
      judul: `Neraca ${cap}`,
      keterangan: [`Per akhir ${NAMA_BULAN[periode.sampai - 1]} ${periode.tahun}`, "Aktiva debet positif, pasiva kredit positif", "Sumber: hasil posting (GLBalnc)", waktuExport(session.userid)],
      labelTotal: "Total",
      rows,
      columns: [
        { header: "Sisi", width: 10, value: (r) => r.sisi },
        { header: "Akun", width: 10, value: (r) => r.akun },
        { header: "Nama Akun", width: 45, value: (r) => indent(r.nama, r.level) },
        { header: "Saldo", width: 20, value: (r) => r.saldo, format: "rupiah" },
      ],
      barisTotal: [
        { label: "Total aktiva", nilai: [null, null, null, n.totalAktiva] },
        { label: "Total pasiva", nilai: [null, null, null, n.totalPasiva] },
      ],
    });
    return responseExcel(buffer, `Neraca-${aman(perusahaan)}`);
  }

  return new Response("Laporan tidak dikenal.", { status: 404 });
}
