import "server-only";
import { getPool, sql } from "@/lib/db";

export const PERIODE = ["BULAN", "TAHUN"] as const;
export type Periode = (typeof PERIODE)[number];

export const KONTRAK_MAX = {
  customer: 20,
  lob: 15,
  deskripsi: 2000,
  selesaiDeskripsi: 200,
} as const;

/** Data yang diisi user. Tanggal dalam format YYYY-MM-DD. */
export type KontrakInput = {
  tanggal: string;
  customer: string;
  lob: string;
  deskripsi: string;
  nilaiInvoice: number;
  recurring: boolean;
  recurringTanggalAwal: string;
  recurringPeriode: Periode;
  recurringPeriodeValue: number;
  selesai: boolean;
  selesaiTanggal: string;
  selesaiDeskripsi: string;
};

export type Kontrak = KontrakInput & {
  noRef: number;
  noKontrak: string;
  createUserid: string | null;
  createDate: Date | null;
  updateUserid: string | null;
  updateDate: Date | null;
};

export type KontrakRow = {
  noRef: number;
  noKontrak: string | null;
  tanggal: Date | null;
  customer: string | null;
  customerNama: string | null;
  lob: string | null;
  lobNama: string | null;
  deskripsi: string | null;
  nilaiInvoice: number;
  recurring: number;
  tanggalAwal: Date | null;
  periode: string | null;
  periodeValue: number | null;
  selesai: number | null;
  selesaiTanggal: Date | null;
  selesaiDeskripsi: string | null;
};

export const KONTRAK_STATUS = ["berjalan", "selesai", "sekali"] as const;

/** Filter daftar kontrak dari query string; dipakai halaman daftar dan export Excel. */
export function parseKontrakFilter(get: (key: string) => string | string[] | null | undefined) {
  const str = (k: string) => {
    const v = get(k);
    return typeof v === "string" ? v : "";
  };
  const status = str("status");
  return { q: str("q").trim(), status: (KONTRAK_STATUS as readonly string[]).includes(status) ? status : "" };
}

// Waktu lokal WIB, sama seperti data yang diinput dari aplikasi desktop
const NOW_WIB = "CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time' AS datetime)";

const toDateStr = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export async function getKontrakList(opts: { q?: string; status?: string }): Promise<KontrakRow[]> {
  const pool = await getPool();
  const req = pool.request();
  const where: string[] = [];
  if (opts.q) {
    req.input("q", sql.VarChar(200), `%${opts.q}%`);
    where.push("(k.NO_KONTRAK LIKE @q OR k.CUSTOMER LIKE @q OR c.Nama LIKE @q OR k.DESKRIPSI_KONTRAK LIKE @q)");
  }
  if (opts.status === "berjalan") where.push("k.RECURRING_INVOICE = 1 AND COALESCE(k.KONTRAK_SELESAI, 0) = 0");
  if (opts.status === "selesai") where.push("k.RECURRING_INVOICE = 1 AND k.KONTRAK_SELESAI = 1");
  if (opts.status === "sekali") where.push("COALESCE(k.RECURRING_INVOICE, 0) = 0");

  const r = await req.query<KontrakRow>(
    `SELECT TOP 500 k.NO_REF_KONTRAK AS noRef, k.NO_KONTRAK AS noKontrak, k.TANGGAL AS tanggal,
            k.CUSTOMER AS customer, c.Nama AS customerNama, k.LOB AS lob, l.NAMA AS lobNama,
            k.DESKRIPSI_KONTRAK AS deskripsi,
            COALESCE(k.NILAI_INVOICE, 0) AS nilaiInvoice, COALESCE(k.RECURRING_INVOICE, 0) AS recurring,
            k.RECURRING_INVOICE_TANGGAL_AWAL AS tanggalAwal,
            k.RECURRING_INVOICE_PERIODE AS periode, k.RECURRING_INVOICE_PERIODE_VALUE AS periodeValue,
            k.KONTRAK_SELESAI AS selesai, k.KONTRAK_SELESAI_TANGGAL AS selesaiTanggal,
            k.KONTRAK_SELESAI_DESKRIPSI AS selesaiDeskripsi
     FROM dbo.CUSTOMER_KONTRAK k
     LEFT JOIN dbo.Customer c ON c.Kode = k.CUSTOMER
     LEFT JOIN dbo.LOB l ON l.KODE = k.LOB
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY k.TANGGAL DESC, k.NO_REF_KONTRAK DESC`,
  );
  return r.recordset.map((x) => ({ ...x, nilaiInvoice: Number(x.nilaiInvoice) }));
}

export async function getKontrak(noRef: number): Promise<Kontrak | null> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("noRef", sql.Int, noRef)
    .query("SELECT * FROM dbo.CUSTOMER_KONTRAK WHERE NO_REF_KONTRAK = @noRef");
  const k = r.recordset[0];
  if (!k) return null;
  return {
    noRef: k.NO_REF_KONTRAK,
    noKontrak: k.NO_KONTRAK ?? "",
    tanggal: toDateStr(k.TANGGAL),
    customer: k.CUSTOMER ?? "",
    lob: k.LOB ?? "",
    deskripsi: k.DESKRIPSI_KONTRAK ?? "",
    nilaiInvoice: Number(k.NILAI_INVOICE ?? 0),
    recurring: Number(k.RECURRING_INVOICE) === 1,
    recurringTanggalAwal: toDateStr(k.RECURRING_INVOICE_TANGGAL_AWAL),
    recurringPeriode: k.RECURRING_INVOICE_PERIODE === "TAHUN" ? "TAHUN" : "BULAN",
    recurringPeriodeValue: k.RECURRING_INVOICE_PERIODE_VALUE ?? 1,
    selesai: Number(k.KONTRAK_SELESAI) === 1,
    selesaiTanggal: toDateStr(k.KONTRAK_SELESAI_TANGGAL),
    selesaiDeskripsi: k.KONTRAK_SELESAI_DESKRIPSI ?? "",
    createUserid: k.CREATE_USERID,
    createDate: k.CREATE_DATE,
    updateUserid: k.UPDATE_USERID,
    updateDate: k.UPDATE_DATE,
  };
}

export async function getCustomerOptions() {
  const pool = await getPool();
  const r = await pool
    .request()
    .query<{ kode: string; nama: string }>(
      "SELECT Kode AS kode, COALESCE(Nama, Kode) AS nama FROM dbo.Customer WHERE COALESCE(FLAG_CUSTOMER, 0) = 1 ORDER BY Nama",
    );
  return r.recordset;
}

export async function getLobOptions() {
  const pool = await getPool();
  const r = await pool.request().query<{ kode: string; nama: string }>("SELECT KODE AS kode, NAMA AS nama FROM dbo.LOB ORDER BY KODE");
  return r.recordset;
}

export async function existsCustomer(kode: string) {
  const pool = await getPool();
  const r = await pool.request().input("kode", sql.VarChar(20), kode).query("SELECT 1 AS ok FROM dbo.Customer WHERE Kode = @kode");
  return r.recordset.length > 0;
}

export async function existsLob(kode: string) {
  const pool = await getPool();
  const r = await pool.request().input("kode", sql.VarChar(15), kode).query("SELECT 1 AS ok FROM dbo.LOB WHERE KODE = @kode");
  return r.recordset.length > 0;
}

/** Bind semua kolom isian. Field recurring/selesai dikosongkan (NULL) jika tidak berlaku. */
function bindInput(req: import("mssql").Request, d: KontrakInput) {
  const recurring = d.recurring;
  const selesai = recurring && d.selesai;
  return req
    .input("tanggal", sql.Date, d.tanggal)
    .input("customer", sql.VarChar(20), d.customer)
    .input("lob", sql.VarChar(15), d.lob)
    .input("deskripsi", sql.VarChar(2000), d.deskripsi || null)
    .input("nilaiInvoice", sql.Decimal(18, 2), d.nilaiInvoice)
    .input("recurring", sql.Int, recurring ? 1 : 0)
    .input("recTglAwal", sql.Date, recurring ? d.recurringTanggalAwal : null)
    .input("recPeriode", sql.VarChar(20), recurring ? d.recurringPeriode : null)
    .input("recValue", sql.Int, recurring ? d.recurringPeriodeValue : null)
    .input("selesai", sql.Int, recurring ? (selesai ? 1 : 0) : null)
    .input("selesaiTgl", sql.Date, selesai ? d.selesaiTanggal : null)
    .input("selesaiDesk", sql.VarChar(200), selesai ? d.selesaiDeskripsi : null);
}

const DATA_COLUMNS = `TANGGAL, CUSTOMER, LOB, DESKRIPSI_KONTRAK, NILAI_INVOICE,
  RECURRING_INVOICE, RECURRING_INVOICE_TANGGAL_AWAL, RECURRING_INVOICE_PERIODE, RECURRING_INVOICE_PERIODE_VALUE,
  KONTRAK_SELESAI, KONTRAK_SELESAI_TANGGAL, KONTRAK_SELESAI_DESKRIPSI`;
const DATA_PARAMS = `@tanggal, @customer, @lob, @deskripsi, @nilaiInvoice,
  @recurring, @recTglAwal, @recPeriode, @recValue, @selesai, @selesaiTgl, @selesaiDesk`;

export async function insertKontrak(data: KontrakInput, userid: string) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    // GET_NO_REF dipanggil di transaksi yang sama dengan INSERT agar baris counter
    // terkunci sampai commit, sehingga dua penyimpanan bersamaan tidak mendapat nomor yang sama.
    const proc = await new sql.Request(tx).output("NO_REF", sql.Int).execute("dbo.GET_NO_REF");
    const noRef = proc.output.NO_REF as number;
    if (!noRef) throw new Error("GET_NO_REF tidak mengembalikan nomor");

    // No. kontrak YYMM.XXX dari tanggal kontrak, urutan per bulan.
    // UPDLOCK+HOLDLOCK mengunci rentang nomor bulan tsb sampai commit.
    const prefix = `${data.tanggal.slice(2, 4)}${data.tanggal.slice(5, 7)}.`;
    const last = await new sql.Request(tx)
      .input("pattern", sql.VarChar(50), `${prefix}%`)
      .query<{ NO_KONTRAK: string }>(
        "SELECT NO_KONTRAK FROM dbo.CUSTOMER_KONTRAK WITH (UPDLOCK, HOLDLOCK) WHERE NO_KONTRAK LIKE @pattern",
      );
    const max = last.recordset.reduce((m, { NO_KONTRAK }) => {
      const n = Number(NO_KONTRAK.slice(prefix.length));
      return Number.isInteger(n) && n > m ? n : m;
    }, 0);
    const noKontrak = `${prefix}${String(max + 1).padStart(3, "0")}`;

    await bindInput(new sql.Request(tx), data)
      .input("noRef", sql.Int, noRef)
      .input("noKontrak", sql.VarChar(50), noKontrak)
      .input("userid", sql.VarChar(50), userid)
      .query(
        `INSERT INTO dbo.CUSTOMER_KONTRAK (NO_REF_KONTRAK, NO_KONTRAK, ${DATA_COLUMNS}, CREATE_USERID, CREATE_DATE, UPDATE_USERID, UPDATE_DATE)
         VALUES (@noRef, @noKontrak, ${DATA_PARAMS}, @userid, ${NOW_WIB}, @userid, ${NOW_WIB})`,
      );
    await tx.commit();
    return { noRef, noKontrak };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

export async function updateKontrak(noRef: number, data: KontrakInput, userid: string) {
  const pool = await getPool();
  const r = await bindInput(pool.request(), data)
    .input("noRef", sql.Int, noRef)
    .input("userid", sql.VarChar(50), userid)
    .query(
      `UPDATE dbo.CUSTOMER_KONTRAK SET
         TANGGAL = @tanggal, CUSTOMER = @customer, LOB = @lob,
         DESKRIPSI_KONTRAK = @deskripsi, NILAI_INVOICE = @nilaiInvoice,
         RECURRING_INVOICE = @recurring, RECURRING_INVOICE_TANGGAL_AWAL = @recTglAwal,
         RECURRING_INVOICE_PERIODE = @recPeriode, RECURRING_INVOICE_PERIODE_VALUE = @recValue,
         KONTRAK_SELESAI = @selesai, KONTRAK_SELESAI_TANGGAL = @selesaiTgl, KONTRAK_SELESAI_DESKRIPSI = @selesaiDesk,
         UPDATE_USERID = @userid, UPDATE_DATE = ${NOW_WIB}
       WHERE NO_REF_KONTRAK = @noRef`,
    );
  return r.rowsAffected[0] > 0;
}
