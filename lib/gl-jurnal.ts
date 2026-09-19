import "server-only";
import { getPool, sql } from "@/lib/db";

// Menulis TRNHDR, TRNDTL, DOC, dan COUNTER_BLN saja.
// GLBalnc / GLBalnc_DTL (hasil posting) TIDAK diubah dari sini; diisi oleh program posting terpisah.

type Tx = import("mssql").Transaction;

// Waktu lokal WIB, sama seperti data yang diinput dari aplikasi desktop
const NOW_WIB = "CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time' AS datetime)";

export const JURNAL_MAX = { remarks: 100, keterangan: 100, lines: 200 };
export const JENIS_INPUT = "BMM";

/** Kesalahan yang aman ditampilkan ke user. */
export class JurnalError extends Error {}

export type JurnalLineInput = { akun: string; keterangan: string; cc: string; debet: number; kredit: number };
export type JurnalInput = { tanggal: string; remarks: string; lines: JurnalLineInput[] };
export type NewFoto = { ext: string; bytes: Buffer };

async function inTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const result = await fn(tx);
    await tx.commit();
    return result;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

async function newNoRef(tx: Tx): Promise<number> {
  // Dipanggil di transaksi yang sama dengan INSERT agar baris counter terkunci sampai commit
  const proc = await new sql.Request(tx).output("NO_REF", sql.Int).execute("dbo.GET_NO_REF");
  const noRef = proc.output.NO_REF as number;
  if (!noRef) throw new Error("GET_NO_REF tidak mengembalikan nomor");
  return noRef;
}

/**
 * Nomor jurnal BMM/XXXX/MM/YY dari COUNTER_BLN (JENIS_TRN 'JURNAL', JENIS 'BMM') per perusahaan, tahun, bulan.
 * Ada data lama yang nomornya melebihi counter, jadi ambil yang terbesar antara counter dan nomor yang sudah ada.
 */
async function nextTcode(tx: Tx, perusahaan: string, tanggal: string): Promise<string> {
  const tahun = Number(tanggal.slice(0, 4));
  const bulan = Number(tanggal.slice(5, 7));
  const mmyy = `${tanggal.slice(5, 7)}/${tanggal.slice(2, 4)}`;

  const counter = await new sql.Request(tx)
    .input("perusahaan", sql.VarChar(50), perusahaan)
    .input("jenis", sql.VarChar(10), JENIS_INPUT)
    .input("tahun", sql.Int, tahun)
    .input("bulan", sql.Int, bulan)
    .query<{ LAST_COUNTER: number | null }>(
      `SELECT LAST_COUNTER FROM dbo.COUNTER_BLN WITH (UPDLOCK, HOLDLOCK)
       WHERE PERUSAHAAN = @perusahaan AND JENIS_TRN = 'JURNAL' AND JENIS = @jenis AND TAHUN = @tahun AND BULAN = @bulan`,
    );
  const ada = await new sql.Request(tx)
    .input("perusahaan", sql.VarChar(50), perusahaan)
    .input("pattern", sql.VarChar(30), `${JENIS_INPUT}/____/${mmyy}`)
    .query<{ maxNo: number | null }>(
      `SELECT MAX(TRY_CAST(SUBSTRING(TCODE, 5, 4) AS int)) AS maxNo FROM dbo.TRNHDR WITH (UPDLOCK, HOLDLOCK)
       WHERE PERUSAHAAN = @perusahaan AND TCODE LIKE @pattern`,
    );
  const next = Math.max(Number(counter.recordset[0]?.LAST_COUNTER ?? 0), Number(ada.recordset[0]?.maxNo ?? 0)) + 1;

  await new sql.Request(tx)
    .input("perusahaan", sql.VarChar(50), perusahaan)
    .input("jenis", sql.VarChar(10), JENIS_INPUT)
    .input("tahun", sql.Int, tahun)
    .input("bulan", sql.Int, bulan)
    .input("next", sql.Int, next)
    .query(
      counter.recordset.length
        ? `UPDATE dbo.COUNTER_BLN SET LAST_COUNTER = @next
           WHERE PERUSAHAAN = @perusahaan AND JENIS_TRN = 'JURNAL' AND JENIS = @jenis AND TAHUN = @tahun AND BULAN = @bulan`
        : `INSERT INTO dbo.COUNTER_BLN (PERUSAHAAN, JENIS_TRN, JENIS, TAHUN, BULAN, LAST_COUNTER)
           VALUES (@perusahaan, 'JURNAL', @jenis, @tahun, @bulan, @next)`,
    );
  return `${JENIS_INPUT}/${String(next).padStart(4, "0")}/${mmyy}`;
}

const total = (lines: JurnalLineInput[], k: "debet" | "kredit") => Math.round(lines.reduce((s, l) => s + l[k], 0) * 100) / 100;

async function insertLines(tx: Tx, noRef: number, tanggal: string, lines: JurnalLineInput[]) {
  let virtkey = 0;
  for (const l of lines) {
    virtkey += 1;
    await new sql.Request(tx)
      .input("noRef", sql.Int, noRef)
      .input("virtkey", sql.Int, virtkey)
      .input("ref1", sql.VarChar(100), l.keterangan || null)
      .input("tanggal", sql.Date, tanggal)
      .input("akun", sql.VarChar(20), l.akun)
      .input("debet", sql.Decimal(18, 2), l.debet)
      .input("kredit", sql.Decimal(18, 2), l.kredit)
      .input("cc", sql.VarChar(10), l.cc || null)
      .query(
        `INSERT INTO dbo.TRNDTL (NO_REF, VIRTKEY, TCODE, REF1, REF2, DATE1, ACCOUNT, AMTDB, AMTCR, QTY, AMTDBUSD, AMTCRUSD, CC)
         VALUES (@noRef, @virtkey, NULL, @ref1, NULL, @tanggal, @akun, @debet, @kredit, 0, 0, 0, @cc)`,
      );
  }
}

async function insertFotos(tx: Tx, noRef: number, fotos: NewFoto[], userid: string) {
  if (!fotos.length) return;
  // Kunci rentang ITEM jurnal ini sampai commit agar nomor tidak bentrok
  const r = await new sql.Request(tx)
    .input("noRef", sql.Int, noRef)
    .query<{ maxItem: number }>("SELECT COALESCE(MAX(ITEM), 0) AS maxItem FROM dbo.DOC WITH (UPDLOCK, HOLDLOCK) WHERE NO_REF = @noRef");
  let item = r.recordset[0].maxItem;
  for (const f of fotos) {
    item += 1;
    await new sql.Request(tx)
      .input("noRef", sql.Int, noRef)
      .input("item", sql.Int, item)
      .input("dokumen", sql.Image, f.bytes)
      .input("ext", sql.VarChar(10), f.ext.toUpperCase())
      .input("filesize", sql.BigInt, f.bytes.length)
      .input("userid", sql.VarChar(50), userid)
      .query(
        `INSERT INTO dbo.DOC (NO_REF, ITEM, DOKUMEN, EXT, FILESIZE, UPLOAD_USERID, UPLOAD_DATE)
         VALUES (@noRef, @item, @dokumen, @ext, @filesize, @userid, ${NOW_WIB})`,
      );
  }
}

export async function insertJurnal(perusahaan: string, data: JurnalInput, fotos: NewFoto[], userid: string): Promise<number> {
  return inTransaction(async (tx) => {
    const noRef = await newNoRef(tx);
    const tcode = await nextTcode(tx, perusahaan, data.tanggal);
    await new sql.Request(tx)
      .input("perusahaan", sql.VarChar(50), perusahaan)
      .input("noRef", sql.Int, noRef)
      .input("tcode", sql.VarChar(30), tcode)
      .input("tanggal", sql.Date, data.tanggal)
      .input("remarks", sql.VarChar(100), data.remarks || null)
      .input("totdb", sql.Float, total(data.lines, "debet"))
      .input("totcr", sql.Float, total(data.lines, "kredit"))
      .input("jenis", sql.VarChar(5), JENIS_INPUT)
      .input("userid", sql.VarChar(10), userid.slice(0, 10))
      .query(
        `INSERT INTO dbo.TRNHDR (PERUSAHAAN, NO_REF, TCODE, TDATE, POSTED, REMARKS, TOTDB, TOTCR, CALCCURRENCY, ALWCONVERTIDR,
           TOTDBUSD, TOTCRUSD, JENIS, CREATE_USERID, CREATE_DATE, UPDATE_USERID, UPDATE_DATE)
         VALUES (@perusahaan, @noRef, @tcode, @tanggal, 0, @remarks, @totdb, @totcr, 1, 1,
           0, 0, @jenis, @userid, ${NOW_WIB}, @userid, ${NOW_WIB})`,
      );
    await insertLines(tx, noRef, data.tanggal, data.lines);
    await insertFotos(tx, noRef, fotos, userid);
    return noRef;
  });
}

/** Ubah jurnal: header di-update, baris ditulis ulang, foto baru ditambahkan. false jika jurnal tidak ada. */
export async function updateJurnal(perusahaan: string, noRef: number, data: JurnalInput, fotos: NewFoto[], userid: string): Promise<boolean> {
  return inTransaction(async (tx) => {
    const cur = await new sql.Request(tx)
      .input("perusahaan", sql.VarChar(50), perusahaan)
      .input("noRef", sql.Int, noRef)
      .query<{ TDATE: Date | null; TCODE: string | null; JENIS: string | null }>(
        "SELECT TDATE, TCODE, JENIS FROM dbo.TRNHDR WITH (UPDLOCK) WHERE PERUSAHAAN = @perusahaan AND NO_REF = @noRef",
      );
    const h = cur.recordset[0];
    if (!h) return false;
    if ((h.JENIS ?? "").trim() !== JENIS_INPUT) throw new JurnalError("Hanya jurnal input (BMM) yang bisa diubah.");

    // Nomor jurnal memuat bulan/tahun; ganti nomor jika tanggal pindah bulan
    const lama = h.TDATE ? h.TDATE.toISOString().slice(0, 7) : "";
    const tcode = lama === data.tanggal.slice(0, 7) && h.TCODE ? h.TCODE : await nextTcode(tx, perusahaan, data.tanggal);

    await new sql.Request(tx)
      .input("perusahaan", sql.VarChar(50), perusahaan)
      .input("noRef", sql.Int, noRef)
      .input("tcode", sql.VarChar(30), tcode)
      .input("tanggal", sql.Date, data.tanggal)
      .input("remarks", sql.VarChar(100), data.remarks || null)
      .input("totdb", sql.Float, total(data.lines, "debet"))
      .input("totcr", sql.Float, total(data.lines, "kredit"))
      .input("userid", sql.VarChar(10), userid.slice(0, 10))
      .query(
        `UPDATE dbo.TRNHDR SET TCODE = @tcode, TDATE = @tanggal, REMARKS = @remarks, TOTDB = @totdb, TOTCR = @totcr,
           UPDATE_USERID = @userid, UPDATE_DATE = ${NOW_WIB}
         WHERE PERUSAHAAN = @perusahaan AND NO_REF = @noRef`,
      );
    await new sql.Request(tx).input("noRef", sql.Int, noRef).query("DELETE FROM dbo.TRNDTL WHERE NO_REF = @noRef");
    await insertLines(tx, noRef, data.tanggal, data.lines);
    await insertFotos(tx, noRef, fotos, userid);
    return true;
  });
}

export async function deleteJurnal(perusahaan: string, noRef: number): Promise<boolean> {
  return inTransaction(async (tx) => {
    const r = await new sql.Request(tx)
      .input("perusahaan", sql.VarChar(50), perusahaan)
      .input("noRef", sql.Int, noRef)
      .query<{ JENIS: string | null }>("SELECT JENIS FROM dbo.TRNHDR WITH (UPDLOCK) WHERE PERUSAHAAN = @perusahaan AND NO_REF = @noRef");
    const h = r.recordset[0];
    if (!h) return false;
    if ((h.JENIS ?? "").trim() !== JENIS_INPUT) throw new JurnalError("Hanya jurnal input (BMM) yang bisa dihapus.");
    for (const q of ["DELETE FROM dbo.DOC WHERE NO_REF = @noRef", "DELETE FROM dbo.TRNDTL WHERE NO_REF = @noRef", "DELETE FROM dbo.TRNHDR WHERE NO_REF = @noRef"])
      await new sql.Request(tx).input("noRef", sql.Int, noRef).query(q);
    return true;
  });
}

// ---------- Foto (DOC) ----------

export async function addFotos(perusahaan: string, noRef: number, fotos: NewFoto[], userid: string): Promise<boolean> {
  return inTransaction(async (tx) => {
    const r = await new sql.Request(tx)
      .input("perusahaan", sql.VarChar(50), perusahaan)
      .input("noRef", sql.Int, noRef)
      .query("SELECT 1 AS ok FROM dbo.TRNHDR WITH (UPDLOCK) WHERE PERUSAHAAN = @perusahaan AND NO_REF = @noRef");
    if (!r.recordset.length) return false;
    await insertFotos(tx, noRef, fotos, userid);
    return true;
  });
}

export async function deleteFoto(perusahaan: string, noRef: number, item: number): Promise<boolean> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("perusahaan", sql.VarChar(50), perusahaan)
    .input("noRef", sql.Int, noRef)
    .input("item", sql.Int, item)
    .query(
      `DELETE d FROM dbo.DOC d JOIN dbo.TRNHDR h ON h.NO_REF = d.NO_REF
       WHERE h.PERUSAHAAN = @perusahaan AND d.NO_REF = @noRef AND d.ITEM = @item`,
    );
  return r.rowsAffected[0] > 0;
}

export type Foto = { bytes: Buffer; ext: string; perusahaan: string };

export async function getFoto(noRef: number, item: number): Promise<Foto | null> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("noRef", sql.Int, noRef)
    .input("item", sql.Int, item)
    .query<{ DOKUMEN: Buffer | null; EXT: string | null; PERUSAHAAN: string }>(
      `SELECT d.DOKUMEN, d.EXT, h.PERUSAHAAN FROM dbo.DOC d JOIN dbo.TRNHDR h ON h.NO_REF = d.NO_REF
       WHERE d.NO_REF = @noRef AND d.ITEM = @item`,
    );
  const row = r.recordset[0];
  return row?.DOKUMEN ? { bytes: row.DOKUMEN, ext: (row.EXT ?? "").toLowerCase(), perusahaan: row.PERUSAHAAN } : null;
}

// ---------- Copy jurnal dari perusahaan lain ----------

export type SumberJurnal = {
  noRef: number;
  tcode: string;
  tanggal: string;
  remarks: string;
  lines: { akun: string; nama: string; keterangan: string; cc: string; debet: number; kredit: number }[];
  fotoCount: number;
};

/** Jurnal-jurnal sumber (perusahaan lain) lengkap dengan barisnya; hanya yang benar-benar milik `sumber`. */
export async function getJurnalSumber(sumber: string, noRefs: number[]): Promise<SumberJurnal[]> {
  if (!noRefs.length) return [];
  const pool = await getPool();
  // Daftar NO_REF sebagai parameter @n0, @n1, ... (dipakai dua query)
  const withNoRefs = (req: import("mssql").Request) => {
    req.input("sumber", sql.VarChar(50), sumber);
    return noRefs.map((n, i) => {
      req.input(`n${i}`, sql.Int, n);
      return `@n${i}`;
    }).join(",");
  };
  const reqHdr = pool.request();
  const reqDtl = pool.request();
  const [hdr, dtl] = await Promise.all([
    reqHdr.query<{ NO_REF: number; TCODE: string | null; TDATE: Date | null; REMARKS: string | null; foto: number }>(
      `SELECT h.NO_REF, h.TCODE, h.TDATE, h.REMARKS, (SELECT COUNT(*) FROM dbo.DOC x WHERE x.NO_REF = h.NO_REF) AS foto
       FROM dbo.TRNHDR h WHERE h.PERUSAHAAN = @sumber AND h.NO_REF IN (${withNoRefs(reqHdr)}) ORDER BY h.TDATE, h.NO_REF`,
    ),
    reqDtl.query<{ NO_REF: number; ACCOUNT: string; NAMA: string | null; REF1: string | null; CC: string | null; AMTDB: number | null; AMTCR: number | null }>(
      `SELECT d.NO_REF, d.ACCOUNT, a.Name AS NAMA, d.REF1, d.CC, d.AMTDB, d.AMTCR
       FROM dbo.TRNDTL d
       JOIN dbo.TRNHDR h ON h.NO_REF = d.NO_REF
       LEFT JOIN dbo.GLAcc a ON a.PERUSAHAAN = @sumber AND a.Acc = d.ACCOUNT
       WHERE h.PERUSAHAAN = @sumber AND d.NO_REF IN (${withNoRefs(reqDtl)})
       ORDER BY d.NO_REF, d.VIRTKEY`,
    ),
  ]);
  return hdr.recordset.map((h) => ({
    noRef: h.NO_REF,
    tcode: h.TCODE ?? "",
    tanggal: h.TDATE ? h.TDATE.toISOString().slice(0, 10) : "",
    remarks: h.REMARKS?.trim() ?? "",
    fotoCount: Number(h.foto ?? 0),
    lines: dtl.recordset
      .filter((d) => d.NO_REF === h.NO_REF)
      .map((d) => ({
        akun: d.ACCOUNT,
        nama: d.NAMA?.trim() || "-",
        keterangan: d.REF1?.trim() ?? "",
        cc: d.CC?.trim() ?? "",
        debet: Math.round(Number(d.AMTDB ?? 0) * 100) / 100,
        kredit: Math.round(Number(d.AMTCR ?? 0) * 100) / 100,
      })),
  }));
}

/**
 * Salin jurnal (TRNHDR, TRNDTL, DOC) ke `tujuan` dengan NO_REF dan nomor jurnal baru.
 * `mapAkun` mengganti kode akun sumber yang tidak ada di tujuan. Semua jurnal dalam satu transaksi.
 */
export async function copyJurnal(
  tujuan: string,
  jurnal: SumberJurnal[],
  mapAkun: Record<string, string>,
  ccTujuan: Set<string>,
  userid: string,
): Promise<number[]> {
  return inTransaction(async (tx) => {
    const hasil: number[] = [];
    for (const j of jurnal) {
      const noRef = await newNoRef(tx);
      const tcode = await nextTcode(tx, tujuan, j.tanggal);
      const lines: JurnalLineInput[] = j.lines.map((l) => ({
        akun: mapAkun[l.akun] ?? l.akun,
        keterangan: l.keterangan,
        // Cost center hanya dibawa jika ada di perusahaan tujuan
        cc: ccTujuan.has(l.cc) ? l.cc : "",
        debet: l.debet,
        kredit: l.kredit,
      }));
      await new sql.Request(tx)
        .input("perusahaan", sql.VarChar(50), tujuan)
        .input("noRef", sql.Int, noRef)
        .input("tcode", sql.VarChar(30), tcode)
        .input("tanggal", sql.Date, j.tanggal)
        .input("remarks", sql.VarChar(100), j.remarks || null)
        .input("totdb", sql.Float, total(lines, "debet"))
        .input("totcr", sql.Float, total(lines, "kredit"))
        .input("jenis", sql.VarChar(5), JENIS_INPUT)
        .input("userid", sql.VarChar(10), userid.slice(0, 10))
        .query(
          `INSERT INTO dbo.TRNHDR (PERUSAHAAN, NO_REF, TCODE, TDATE, POSTED, REMARKS, TOTDB, TOTCR, CALCCURRENCY, ALWCONVERTIDR,
             TOTDBUSD, TOTCRUSD, JENIS, CREATE_USERID, CREATE_DATE, UPDATE_USERID, UPDATE_DATE)
           VALUES (@perusahaan, @noRef, @tcode, @tanggal, 0, @remarks, @totdb, @totcr, 1, 1,
             0, 0, @jenis, @userid, ${NOW_WIB}, @userid, ${NOW_WIB})`,
        );
      await insertLines(tx, noRef, j.tanggal, lines);
      // Foto disalin di server (INSERT ... SELECT), tidak lewat aplikasi
      await new sql.Request(tx)
        .input("baru", sql.Int, noRef)
        .input("sumber", sql.Int, j.noRef)
        .input("userid", sql.VarChar(50), userid)
        .query(
          `INSERT INTO dbo.DOC (NO_REF, ITEM, DESCRIPTION, ATTACHMENT, DOKUMEN, EXT, FILESIZE, UPLOAD_USERID, UPLOAD_DATE)
           SELECT @baru, ITEM, DESCRIPTION, ATTACHMENT, DOKUMEN, EXT, FILESIZE, @userid, ${NOW_WIB}
           FROM dbo.DOC WHERE NO_REF = @sumber`,
        );
      hasil.push(noRef);
    }
    return hasil;
  });
}
