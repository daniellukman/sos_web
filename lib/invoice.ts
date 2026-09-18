import "server-only";
import { getPool, sql } from "@/lib/db";
import { cariPeriode, hitungPeriode, hitungTotal, kaliHarga, type KontrakJadwal, type Periode } from "@/lib/invoice-period";

export const PERUSAHAAN = "SOS";
export const LOKASI = "SOS";

// Waktu lokal WIB, sama seperti data yang diinput dari aplikasi desktop
const NOW_WIB = "CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time' AS datetime)";
const toDateStr = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export type KontrakInvoice = KontrakJadwal & {
  noRef: number;
  noKontrak: string;
  customer: string;
  customerNama: string | null;
  lob: string;
  lobNama: string | null;
  deskripsi: string;
  nilaiInvoice: number;
};

export type Outstanding = { kontrak: KontrakInvoice; periode: Periode };

type KontrakRow = {
  NO_REF_KONTRAK: number;
  NO_KONTRAK: string | null;
  TANGGAL: Date | null;
  CUSTOMER: string | null;
  CUSTOMER_NAMA: string | null;
  LOB: string | null;
  LOB_NAMA: string | null;
  DESKRIPSI_KONTRAK: string | null;
  NILAI_INVOICE: number | null;
  RECURRING_INVOICE: number | null;
  RECURRING_INVOICE_TANGGAL_AWAL: Date | null;
  RECURRING_INVOICE_PERIODE: string | null;
  RECURRING_INVOICE_PERIODE_VALUE: number | null;
  KONTRAK_SELESAI: number | null;
  KONTRAK_SELESAI_TANGGAL: Date | null;
};

const KONTRAK_SELECT = `
  SELECT k.*, c.Nama AS CUSTOMER_NAMA, l.NAMA AS LOB_NAMA
  FROM dbo.CUSTOMER_KONTRAK k
  LEFT JOIN dbo.Customer c ON c.Kode = k.CUSTOMER
  LEFT JOIN dbo.LOB l ON l.KODE = k.LOB`;

function toKontrak(r: KontrakRow): KontrakInvoice {
  return {
    noRef: r.NO_REF_KONTRAK,
    noKontrak: r.NO_KONTRAK ?? "",
    tanggal: toDateStr(r.TANGGAL),
    customer: r.CUSTOMER ?? "",
    customerNama: r.CUSTOMER_NAMA,
    lob: r.LOB ?? "",
    lobNama: r.LOB_NAMA,
    deskripsi: r.DESKRIPSI_KONTRAK ?? "",
    nilaiInvoice: Number(r.NILAI_INVOICE ?? 0),
    recurring: Number(r.RECURRING_INVOICE) === 1,
    tanggalAwal: toDateStr(r.RECURRING_INVOICE_TANGGAL_AWAL),
    periode: r.RECURRING_INVOICE_PERIODE,
    periodeValue: r.RECURRING_INVOICE_PERIODE_VALUE,
    selesai: Number(r.KONTRAK_SELESAI) === 1,
    selesaiTanggal: toDateStr(r.KONTRAK_SELESAI_TANGGAL),
  };
}

/** Kunci periode yang sudah diinvoice: "NO_KONTRAK|YYYY-MM-DD" atau "NO_KONTRAK|" untuk invoice 1 kali. */
const kunci = (noKontrak: string, awal: string | null) => `${noKontrak}|${awal ?? ""}`;

async function getSudahInvoice(req: import("mssql").Request, noKontrakFilter?: string) {
  if (noKontrakFilter) req.input("noKontrak", sql.VarChar(50), noKontrakFilter);
  const r = await req
    .input("perusahaan", sql.VarChar(50), PERUSAHAAN)
    .query<{ NO_KONTRAK: string; TANGGAL_AWAL: Date | null }>(
      `SELECT h.NO_KONTRAK, d.TANGGAL_AWAL
       FROM dbo.JUAL_HDR h ${noKontrakFilter ? "WITH (UPDLOCK, HOLDLOCK)" : ""}
       LEFT JOIN dbo.JUAL_DTL d ON d.NO_REF = h.NO_REF
       WHERE h.PERUSAHAAN = @perusahaan AND h.NO_KONTRAK IS NOT NULL AND h.NO_KONTRAK <> ''
       ${noKontrakFilter ? "AND h.NO_KONTRAK = @noKontrak" : ""}`,
    );
  const periode = new Set<string>();
  const adaInvoice = new Set<string>();
  for (const row of r.recordset) {
    adaInvoice.add(row.NO_KONTRAK);
    if (row.TANGGAL_AWAL) periode.add(kunci(row.NO_KONTRAK, toDateStr(row.TANGGAL_AWAL)));
  }
  return { periode, adaInvoice };
}

function belumDiinvoice(k: KontrakInvoice, p: Periode, sudah: { periode: Set<string>; adaInvoice: Set<string> }) {
  // Invoice 1 kali: cukup satu invoice apa pun untuk kontrak ini
  return p.awal === null ? !sudah.adaInvoice.has(k.noKontrak) : !sudah.periode.has(kunci(k.noKontrak, p.awal));
}

/** Semua periode invoice yang jatuh tempo s/d `sampai` dan belum dibuat invoicenya. */
export async function getOutstanding(sampai: string): Promise<Outstanding[]> {
  const pool = await getPool();
  const [kontrak, sudah] = await Promise.all([
    pool.request().query<KontrakRow>(`${KONTRAK_SELECT} WHERE k.NO_KONTRAK IS NOT NULL ORDER BY k.NO_KONTRAK`),
    getSudahInvoice(pool.request()),
  ]);
  const hasil: Outstanding[] = [];
  for (const row of kontrak.recordset) {
    const k = toKontrak(row);
    for (const p of hitungPeriode(k, sampai)) {
      if (belumDiinvoice(k, p, sudah)) hasil.push({ kontrak: k, periode: p });
    }
  }
  return hasil.sort((a, b) => a.periode.jatuhTempo.localeCompare(b.periode.jatuhTempo) || a.kontrak.noKontrak.localeCompare(b.kontrak.noKontrak));
}

/** Satu periode outstanding tertentu, atau null jika tidak sah / sudah diinvoice. */
export async function getOutstandingOne(noRef: number, awal: string | null): Promise<Outstanding | null> {
  const pool = await getPool();
  const r = await pool.request().input("noRef", sql.Int, noRef).query<KontrakRow>(`${KONTRAK_SELECT} WHERE k.NO_REF_KONTRAK = @noRef`);
  if (!r.recordset[0]) return null;
  const k = toKontrak(r.recordset[0]);
  const p = cariPeriode(k, awal);
  if (!p || !k.noKontrak) return null;
  const sudah = await getSudahInvoice(pool.request(), k.noKontrak);
  return belumDiinvoice(k, p, sudah) ? { kontrak: k, periode: p } : null;
}

export type InvoiceInput = {
  tanggal: string;
  keterangan: string;
  pctPpn: number;
  deskripsi: string;
  qty: number;
};

export type InvoiceHasil = { noRef: number; noFaktur: string };

export class SudahDiinvoiceError extends Error {}

export async function insertInvoice(
  noRefKontrak: number,
  awal: string | null,
  data: InvoiceInput,
  userid: string,
): Promise<InvoiceHasil> {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const kr = await new sql.Request(tx)
      .input("noRef", sql.Int, noRefKontrak)
      .query<KontrakRow>(`${KONTRAK_SELECT} WHERE k.NO_REF_KONTRAK = @noRef`);
    if (!kr.recordset[0]) throw new SudahDiinvoiceError("Kontrak tidak ditemukan.");
    const k = toKontrak(kr.recordset[0]);
    const periode = cariPeriode(k, awal);
    if (!periode || !k.noKontrak) throw new SudahDiinvoiceError("Periode invoice tidak valid untuk kontrak ini.");

    // Kunci invoice kontrak ini sampai commit, lalu pastikan periode belum pernah diinvoice
    const sudah = await getSudahInvoice(new sql.Request(tx), k.noKontrak);
    if (!belumDiinvoice(k, periode, sudah)) throw new SudahDiinvoiceError("Periode ini sudah dibuatkan invoice.");

    const proc = await new sql.Request(tx).output("NO_REF", sql.Int).execute("dbo.GET_NO_REF");
    const noRef = proc.output.NO_REF as number;
    if (!noRef) throw new Error("GET_NO_REF tidak mengembalikan nomor");

    // No. faktur INV/SOS/YYMM/XXX dari tanggal faktur, urutan per bulan, dikunci sampai commit
    const prefix = `INV/${PERUSAHAAN}/${data.tanggal.slice(2, 4)}${data.tanggal.slice(5, 7)}/`;
    const last = await new sql.Request(tx)
      .input("pattern", sql.VarChar(20), `${prefix}%`)
      .query<{ NO_FAKTUR: string }>("SELECT NO_FAKTUR FROM dbo.JUAL_HDR WITH (UPDLOCK, HOLDLOCK) WHERE NO_FAKTUR LIKE @pattern");
    const max = last.recordset.reduce((m, { NO_FAKTUR }) => {
      const n = Number(NO_FAKTUR.slice(prefix.length));
      return Number.isInteger(n) && n > m ? n : m;
    }, 0);
    const noFaktur = `${prefix}${String(max + 1).padStart(3, "0")}`;

    // Harga selalu diambil ulang dari kontrak di server; nilai dihitung di sini, bukan dari browser
    const nilaiDetail = kaliHarga(data.qty, k.nilaiInvoice);
    const { nilaiPpn, nilaiAkhir } = hitungTotal(nilaiDetail, data.pctPpn);

    await new sql.Request(tx)
      .input("noRef", sql.Int, noRef)
      .input("perusahaan", sql.VarChar(50), PERUSAHAAN)
      .input("lokasi", sql.VarChar(20), LOKASI)
      .input("noFaktur", sql.VarChar(20), noFaktur)
      .input("tanggal", sql.Date, data.tanggal)
      .input("customer", sql.VarChar(20), k.customer)
      .input("nsp", sql.Decimal(18, 2), nilaiDetail)
      .input("pct", sql.Decimal(18, 2), data.pctPpn)
      .input("ppn", sql.Decimal(18, 2), nilaiPpn)
      .input("akhir", sql.Decimal(18, 2), nilaiAkhir)
      .input("userid", sql.VarChar(50), userid)
      .input("keterangan", sql.VarChar(200), data.keterangan || null)
      .input("noKontrak", sql.VarChar(50), k.noKontrak)
      .input("lob", sql.VarChar(15), k.lob || null)
      .query(
        `INSERT INTO dbo.JUAL_HDR (NO_REF, PERUSAHAAN, LOKASI, NO_FAKTUR, TANGGAL, CUSTOMER, NO_FP,
           NILAI_SEBELUM_PPN, PCT_PPN, NILAI_PPN, NILAI_AKHIR, NILAI_DIBAYAR, FLAG_LUNAS, TULIS_CSV,
           CREATE_USERID, CREATE_DATE, UPDATE_USERID, UPDATE_DATE, KETERANGAN, POTONG_STOCK, NO_KONTRAK, LOB)
         VALUES (@noRef, @perusahaan, @lokasi, @noFaktur, @tanggal, @customer, NULL,
           @nsp, @pct, @ppn, @akhir, 0, 0, NULL,
           @userid, ${NOW_WIB}, @userid, ${NOW_WIB}, @keterangan, 0, @noKontrak, @lob)`,
      );

    await new sql.Request(tx)
      .input("noRef", sql.Int, noRef)
      .input("deskripsi", sql.VarChar(2000), data.deskripsi)
      .input("qty", sql.Int, data.qty)
      .input("harga", sql.Decimal(18, 2), k.nilaiInvoice)
      .input("nilai", sql.Decimal(18, 2), nilaiDetail)
      .input("awal", sql.Date, periode.awal)
      .input("akhir", sql.Date, periode.akhir)
      .query(
        `INSERT INTO dbo.JUAL_DTL (NO_REF, ITEM, DESKRIPSI, QTY, HARGA, NILAI_DETAIL, TANGGAL_AWAL, TANGGAL_AKHIR)
         VALUES (@noRef, 1, @deskripsi, @qty, @harga, @nilai, @awal, @akhir)`,
      );

    await tx.commit();
    return { noRef, noFaktur };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}
