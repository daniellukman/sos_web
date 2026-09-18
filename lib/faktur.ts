import "server-only";
import { getPool, sql } from "@/lib/db";
import { PERUSAHAAN } from "@/lib/invoice";
import { hitungTotal, kaliHarga } from "@/lib/invoice-period";

// Waktu lokal WIB, sama seperti data yang diinput dari aplikasi desktop
const NOW_WIB = "CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time' AS datetime)";
const toDateStr = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export type StatusBayar = "lunas" | "sebagian" | "belum";

export type FakturRow = {
  noRef: number;
  noFaktur: string;
  tanggal: string;
  customer: string;
  customerNama: string | null;
  noKontrak: string | null;
  nilaiSebelumPpn: number;
  nilaiPpn: number;
  nilaiAkhir: number;
  nilaiDibayar: number;
  status: StatusBayar;
};

type HdrRow = {
  NO_REF: number;
  NO_FAKTUR: string | null;
  TANGGAL: Date | null;
  CUSTOMER: string | null;
  CUSTOMER_NAMA: string | null;
  NO_KONTRAK: string | null;
  NILAI_SEBELUM_PPN: number | null;
  PCT_PPN: number | null;
  NILAI_PPN: number | null;
  NILAI_AKHIR: number | null;
  NILAI_DIBAYAR: number | null;
  FLAG_LUNAS: number | null;
};

function status(r: HdrRow): StatusBayar {
  const akhir = Number(r.NILAI_AKHIR ?? 0);
  const dibayar = Number(r.NILAI_DIBAYAR ?? 0);
  if (Number(r.FLAG_LUNAS ?? 0) !== 0 || (akhir > 0 && dibayar >= akhir)) return "lunas";
  return dibayar > 0 ? "sebagian" : "belum";
}

function toRow(r: HdrRow): FakturRow {
  return {
    noRef: r.NO_REF,
    noFaktur: r.NO_FAKTUR ?? "",
    tanggal: toDateStr(r.TANGGAL),
    customer: r.CUSTOMER ?? "",
    customerNama: r.CUSTOMER_NAMA,
    noKontrak: r.NO_KONTRAK,
    nilaiSebelumPpn: Number(r.NILAI_SEBELUM_PPN ?? 0),
    nilaiPpn: Number(r.NILAI_PPN ?? 0),
    nilaiAkhir: Number(r.NILAI_AKHIR ?? 0),
    nilaiDibayar: Number(r.NILAI_DIBAYAR ?? 0),
    status: status(r),
  };
}

const HDR_SELECT = `
  SELECT h.NO_REF, h.NO_FAKTUR, h.TANGGAL, h.CUSTOMER, c.Nama AS CUSTOMER_NAMA, h.NO_KONTRAK,
         h.NILAI_SEBELUM_PPN, h.PCT_PPN, h.NILAI_PPN, h.NILAI_AKHIR, h.NILAI_DIBAYAR, h.FLAG_LUNAS,
         h.KETERANGAN, h.LOB, l.NAMA AS LOB_NAMA, h.CREATE_USERID, h.CREATE_DATE, h.UPDATE_USERID, h.UPDATE_DATE
  FROM dbo.JUAL_HDR h
  LEFT JOIN dbo.Customer c ON c.Kode = h.CUSTOMER
  LEFT JOIN dbo.LOB l ON l.KODE = h.LOB`;

export type FakturFilter = { q: string; dari: string; sampai: string; status: string };

/** Filter daftar invoice dari query string; dipakai halaman daftar dan export Excel agar hasilnya sama. */
export function parseFakturFilter(get: (key: string) => string | string[] | null | undefined): FakturFilter {
  const str = (k: string) => {
    const v = get(k);
    return typeof v === "string" ? v : "";
  };
  const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);
  return {
    q: str("q").trim(),
    dari: isDate(str("dari")) ? str("dari") : "",
    sampai: isDate(str("sampai")) ? str("sampai") : "",
    status: ["lunas", "sebagian", "belum"].includes(str("status")) ? str("status") : "",
  };
}

export async function getFakturList(opts: { q?: string; dari?: string; sampai?: string; status?: string }) {
  const pool = await getPool();
  const req = pool.request().input("perusahaan", sql.VarChar(50), PERUSAHAAN);
  const where = ["h.PERUSAHAAN = @perusahaan"];
  if (opts.q) {
    req.input("q", sql.VarChar(200), `%${opts.q}%`);
    where.push("(h.NO_FAKTUR LIKE @q OR h.CUSTOMER LIKE @q OR c.Nama LIKE @q OR h.NO_KONTRAK LIKE @q OR h.KETERANGAN LIKE @q)");
  }
  if (opts.dari) {
    req.input("dari", sql.Date, opts.dari);
    where.push("h.TANGGAL >= @dari");
  }
  if (opts.sampai) {
    req.input("sampai", sql.Date, opts.sampai);
    where.push("h.TANGGAL < DATEADD(day, 1, @sampai)");
  }
  const r = await req.query<HdrRow>(`SELECT TOP 500 * FROM (${HDR_SELECT} WHERE ${where.join(" AND ")}) x ORDER BY TANGGAL DESC, NO_REF DESC`);
  const rows = r.recordset.map(toRow);
  return opts.status ? rows.filter((x) => x.status === opts.status) : rows;
}

export type FakturLine = {
  item: number;
  deskripsi: string;
  qty: number;
  harga: number;
  nilai: number;
  tanggalAwal: string;
  tanggalAkhir: string;
};

export type FakturDetail = FakturRow & {
  pctPpn: number;
  keterangan: string;
  lob: string | null;
  lobNama: string | null;
  createUserid: string | null;
  createDate: Date | null;
  updateUserid: string | null;
  updateDate: Date | null;
  lines: FakturLine[];
  /** Hanya invoice dari kontrak yang belum ada pembayaran yang boleh diedit dari web */
  bisaEdit: boolean;
  alasanTidakBisaEdit: string | null;
};

export async function getFaktur(noRef: number): Promise<FakturDetail | null> {
  const pool = await getPool();
  const [h, d] = await Promise.all([
    pool
      .request()
      .input("noRef", sql.Int, noRef)
      .input("perusahaan", sql.VarChar(50), PERUSAHAAN)
      .query(`${HDR_SELECT} WHERE h.NO_REF = @noRef AND h.PERUSAHAAN = @perusahaan`),
    pool
      .request()
      .input("noRef", sql.Int, noRef)
      .query("SELECT ITEM, DESKRIPSI, QTY, HARGA, NILAI_DETAIL, TANGGAL_AWAL, TANGGAL_AKHIR FROM dbo.JUAL_DTL WHERE NO_REF = @noRef ORDER BY ITEM"),
  ]);
  const r = h.recordset[0];
  if (!r) return null;
  const row = toRow(r);

  let alasan: string | null = null;
  if (!row.noKontrak) alasan = "Invoice ini tidak dibuat dari kontrak, jadi hanya bisa dilihat dan dicetak.";
  else if (row.nilaiDibayar > 0 || row.status === "lunas") alasan = "Invoice sudah ada pembayaran, tidak bisa diedit.";

  return {
    ...row,
    pctPpn: Number(r.PCT_PPN ?? 0),
    keterangan: r.KETERANGAN ?? "",
    lob: r.LOB,
    lobNama: r.LOB_NAMA,
    createUserid: r.CREATE_USERID,
    createDate: r.CREATE_DATE,
    updateUserid: r.UPDATE_USERID,
    updateDate: r.UPDATE_DATE,
    lines: d.recordset.map((x) => ({
      item: x.ITEM,
      deskripsi: x.DESKRIPSI ?? "",
      qty: Number(x.QTY ?? 0),
      harga: Number(x.HARGA ?? 0),
      nilai: Number(x.NILAI_DETAIL ?? 0),
      tanggalAwal: toDateStr(x.TANGGAL_AWAL),
      tanggalAkhir: toDateStr(x.TANGGAL_AKHIR),
    })),
    bisaEdit: alasan === null,
    alasanTidakBisaEdit: alasan,
  };
}

export type FakturUpdate = {
  tanggal: string;
  keterangan: string;
  pctPpn: number;
  lines: { item: number; deskripsi: string; qty: number }[];
};

export class FakturTidakBisaDieditError extends Error {}

export async function updateFaktur(noRef: number, data: FakturUpdate, userid: string) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    // Kunci baris invoice sampai commit, lalu cek ulang boleh diedit
    const h = await new sql.Request(tx)
      .input("noRef", sql.Int, noRef)
      .input("perusahaan", sql.VarChar(50), PERUSAHAAN)
      .query<HdrRow>(
        `SELECT NO_REF, NO_FAKTUR, TANGGAL, CUSTOMER, NULL AS CUSTOMER_NAMA, NO_KONTRAK, NILAI_SEBELUM_PPN, PCT_PPN,
                NILAI_PPN, NILAI_AKHIR, NILAI_DIBAYAR, FLAG_LUNAS
         FROM dbo.JUAL_HDR WITH (UPDLOCK, HOLDLOCK) WHERE NO_REF = @noRef AND PERUSAHAAN = @perusahaan`,
      );
    const hdr = h.recordset[0];
    if (!hdr) throw new FakturTidakBisaDieditError("Invoice tidak ditemukan.");
    if (!hdr.NO_KONTRAK) throw new FakturTidakBisaDieditError("Invoice ini tidak dibuat dari kontrak.");
    if (Number(hdr.NILAI_DIBAYAR ?? 0) > 0 || status(hdr) === "lunas")
      throw new FakturTidakBisaDieditError("Invoice sudah ada pembayaran, tidak bisa diedit.");

    // Harga selalu dari baris yang tersimpan, nilai dihitung ulang di server
    const d = await new sql.Request(tx)
      .input("noRef", sql.Int, noRef)
      .query<{ ITEM: number; HARGA: number | null }>("SELECT ITEM, HARGA FROM dbo.JUAL_DTL WITH (UPDLOCK) WHERE NO_REF = @noRef");
    const harga = new Map(d.recordset.map((x) => [x.ITEM, Number(x.HARGA ?? 0)]));

    for (const line of data.lines) {
      if (!harga.has(line.item)) throw new FakturTidakBisaDieditError(`Baris ${line.item} tidak ditemukan.`);
      const nilai = kaliHarga(line.qty, harga.get(line.item)!);
      await new sql.Request(tx)
        .input("noRef", sql.Int, noRef)
        .input("item", sql.Int, line.item)
        .input("deskripsi", sql.VarChar(2000), line.deskripsi)
        .input("qty", sql.Int, line.qty)
        .input("nilai", sql.Decimal(18, 2), nilai)
        .query("UPDATE dbo.JUAL_DTL SET DESKRIPSI = @deskripsi, QTY = @qty, NILAI_DETAIL = @nilai WHERE NO_REF = @noRef AND ITEM = @item");
    }
    // NILAI_SEBELUM_PPN = jumlah semua NILAI_DETAIL setelah diperbarui
    const sum = await new sql.Request(tx)
      .input("noRef", sql.Int, noRef)
      .query<{ total: number | null }>("SELECT SUM(NILAI_DETAIL) AS total FROM dbo.JUAL_DTL WHERE NO_REF = @noRef");
    const nilaiSebelumPpn = Number(sum.recordset[0].total ?? 0);

    const { nilaiPpn, nilaiAkhir } = hitungTotal(nilaiSebelumPpn, data.pctPpn);
    await new sql.Request(tx)
      .input("noRef", sql.Int, noRef)
      .input("tanggal", sql.Date, data.tanggal)
      .input("keterangan", sql.VarChar(200), data.keterangan || null)
      .input("nsp", sql.Decimal(18, 2), nilaiSebelumPpn)
      .input("pct", sql.Decimal(18, 2), data.pctPpn)
      .input("ppn", sql.Decimal(18, 2), nilaiPpn)
      .input("akhir", sql.Decimal(18, 2), nilaiAkhir)
      .input("userid", sql.VarChar(50), userid)
      .query(
        `UPDATE dbo.JUAL_HDR SET TANGGAL = @tanggal, KETERANGAN = @keterangan, NILAI_SEBELUM_PPN = @nsp, PCT_PPN = @pct,
           NILAI_PPN = @ppn, NILAI_AKHIR = @akhir, UPDATE_USERID = @userid, UPDATE_DATE = ${NOW_WIB}
         WHERE NO_REF = @noRef`,
      );
    await tx.commit();
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export type CetakInfo = {
  perusahaan: { nama: string; alamat: string | null; npwp: string | null };
  customer: { nama: string; alamat: string[]; npwp: string | null; telp: string | null; email: string | null };
};

export async function getCetakInfo(kodeCustomer: string): Promise<CetakInfo> {
  const pool = await getPool();
  const [p, c] = await Promise.all([
    pool
      .request()
      .input("kode", sql.VarChar(50), PERUSAHAAN)
      .query("SELECT NAMA, NAMA_PAJAK, ALAMAT, NPWP FROM dbo.COMPANY_SETUP WHERE KODE_COMPANY = @kode"),
    pool
      .request()
      .input("kode", sql.VarChar(20), kodeCustomer)
      .query("SELECT Nama, NAMA_PPN, ALAMAT_PPN1, ALAMAT_PPN2, ALAMAT_PPN3, NPWP, Telp, Email FROM dbo.Customer WHERE Kode = @kode"),
  ]);
  const pr = p.recordset[0];
  const cr = c.recordset[0];
  return {
    // Nama di cetakan dari NAMA_PAJAK; jika kosong pakai NAMA
    perusahaan: { nama: pr?.NAMA_PAJAK || pr?.NAMA || "PT. SOS", alamat: pr?.ALAMAT ?? null, npwp: pr?.NPWP ?? null },
    customer: {
      nama: cr?.NAMA_PPN || cr?.Nama || kodeCustomer || "-",
      alamat: [cr?.ALAMAT_PPN1, cr?.ALAMAT_PPN2, cr?.ALAMAT_PPN3].filter(Boolean),
      npwp: cr?.NPWP ?? null,
      telp: cr?.Telp ?? null,
      email: cr?.Email ?? null,
    },
  };
}
