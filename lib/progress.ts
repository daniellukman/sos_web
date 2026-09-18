import "server-only";
import { getPool, sql } from "@/lib/db";

export type ProgressDoc = {
  sub: number;
  ext: string;
  filesize: number;
  createUserid: string | null;
  createDate: Date | null;
};

export type Progress = {
  noRef: number;
  item: number;
  tanggal: string; // YYYY-MM-DD
  deskripsi: string;
  createUserid: string | null;
  createDate: Date | null;
  updateUserid: string | null;
  updateDate: Date | null;
  docs: ProgressDoc[];
};

export type NewFile = { ext: string; bytes: Buffer };

// Waktu lokal WIB, sama seperti data yang diinput dari aplikasi desktop
const NOW_WIB = "CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time' AS datetime)";

const toDateStr = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

type Row = {
  NO_REF: number;
  ITEM: number;
  TANGGAL: Date | null;
  DESKRIPSI_UPDATE: string | null;
  CREATE_USERID: string | null;
  CREATE_DATE: Date | null;
  UPDATE_USERID: string | null;
  UPDATE_DATE: Date | null;
};
type DocRow = { ITEM: number; SUB: number; EXT: string | null; FILESIZE: number | string | null; CREATE_USERID: string | null; CREATE_DATE: Date | null };

function toProgress(r: Row, docs: DocRow[]): Progress {
  return {
    noRef: r.NO_REF,
    item: r.ITEM,
    tanggal: toDateStr(r.TANGGAL),
    deskripsi: r.DESKRIPSI_UPDATE ?? "",
    createUserid: r.CREATE_USERID,
    createDate: r.CREATE_DATE,
    updateUserid: r.UPDATE_USERID,
    updateDate: r.UPDATE_DATE,
    docs: docs
      .filter((d) => d.ITEM === r.ITEM)
      .map((d) => ({
        sub: d.SUB,
        ext: d.EXT ?? "",
        filesize: Number(d.FILESIZE ?? 0),
        createUserid: d.CREATE_USERID,
        createDate: d.CREATE_DATE,
      })),
  };
}

// Kolom DOKUMEN sengaja tidak di-SELECT agar daftar tetap ringan
const DOC_LIST = `SELECT ITEM, SUB, EXT, COALESCE(FILESIZE, DATALENGTH(DOKUMEN)) AS FILESIZE, CREATE_USERID, CREATE_DATE
  FROM dbo.CUSTOMER_KONTRAK_DOC WHERE NO_REF = @noRef`;

/** Semua progress satu kontrak, terbaru dulu. */
export async function getProgressList(noRef: number): Promise<Progress[]> {
  const pool = await getPool();
  const [rows, docs] = await Promise.all([
    pool.request().input("noRef", sql.Int, noRef).query<Row>(
      "SELECT * FROM dbo.CUSTOMER_KONTRAK_UPDATE WHERE NO_REF = @noRef ORDER BY TANGGAL DESC, ITEM DESC",
    ),
    pool.request().input("noRef", sql.Int, noRef).query<DocRow>(`${DOC_LIST} ORDER BY SUB`),
  ]);
  return rows.recordset.map((r) => toProgress(r, docs.recordset));
}

export async function getProgress(noRef: number, item: number): Promise<Progress | null> {
  const pool = await getPool();
  const [rows, docs] = await Promise.all([
    pool
      .request()
      .input("noRef", sql.Int, noRef)
      .input("item", sql.Int, item)
      .query<Row>("SELECT * FROM dbo.CUSTOMER_KONTRAK_UPDATE WHERE NO_REF = @noRef AND ITEM = @item"),
    pool.request().input("noRef", sql.Int, noRef).input("item", sql.Int, item).query<DocRow>(`${DOC_LIST} AND ITEM = @item ORDER BY SUB`),
  ]);
  return rows.recordset[0] ? toProgress(rows.recordset[0], docs.recordset) : null;
}

export async function getDocument(noRef: number, item: number, sub: number) {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("noRef", sql.Int, noRef)
    .input("item", sql.Int, item)
    .input("sub", sql.Int, sub)
    .query<{ DOKUMEN: Buffer | null; EXT: string | null }>(
      "SELECT DOKUMEN, EXT FROM dbo.CUSTOMER_KONTRAK_DOC WHERE NO_REF = @noRef AND ITEM = @item AND SUB = @sub",
    );
  const row = r.recordset[0];
  return row?.DOKUMEN ? { bytes: row.DOKUMEN, ext: (row.EXT ?? "").toLowerCase() } : null;
}

async function insertDocs(tx: import("mssql").Transaction, noRef: number, item: number, files: NewFile[], userid: string) {
  if (!files.length) return;
  // Kunci rentang SUB milik progress ini sampai commit agar nomor tidak bentrok
  const r = await new sql.Request(tx)
    .input("noRef", sql.Int, noRef)
    .input("item", sql.Int, item)
    .query<{ maxSub: number }>(
      "SELECT COALESCE(MAX(SUB), 0) AS maxSub FROM dbo.CUSTOMER_KONTRAK_DOC WITH (UPDLOCK, HOLDLOCK) WHERE NO_REF = @noRef AND ITEM = @item",
    );
  let sub = r.recordset[0].maxSub;
  for (const f of files) {
    sub += 1;
    await new sql.Request(tx)
      .input("noRef", sql.Int, noRef)
      .input("item", sql.Int, item)
      .input("sub", sql.Int, sub)
      .input("dokumen", sql.Image, f.bytes)
      .input("ext", sql.VarChar(20), f.ext)
      .input("filesize", sql.BigInt, f.bytes.length)
      .input("userid", sql.VarChar(50), userid)
      .query(
        `INSERT INTO dbo.CUSTOMER_KONTRAK_DOC (NO_REF, ITEM, SUB, DOKUMEN, EXT, FILESIZE, CREATE_USERID, CREATE_DATE)
         VALUES (@noRef, @item, @sub, @dokumen, @ext, @filesize, @userid, ${NOW_WIB})`,
      );
  }
}

async function inTransaction<T>(fn: (tx: import("mssql").Transaction) => Promise<T>): Promise<T> {
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

export async function insertProgress(
  noRef: number,
  data: { tanggal: string; deskripsi: string },
  files: NewFile[],
  userid: string,
): Promise<number> {
  return inTransaction(async (tx) => {
    // ITEM = urutan per kontrak, dikunci sampai commit
    const r = await new sql.Request(tx)
      .input("noRef", sql.Int, noRef)
      .query<{ maxItem: number }>(
        "SELECT COALESCE(MAX(ITEM), 0) AS maxItem FROM dbo.CUSTOMER_KONTRAK_UPDATE WITH (UPDLOCK, HOLDLOCK) WHERE NO_REF = @noRef",
      );
    const item = r.recordset[0].maxItem + 1;
    await new sql.Request(tx)
      .input("noRef", sql.Int, noRef)
      .input("item", sql.Int, item)
      .input("tanggal", sql.Date, data.tanggal)
      .input("deskripsi", sql.VarChar(2000), data.deskripsi)
      .input("userid", sql.VarChar(50), userid)
      .query(
        `INSERT INTO dbo.CUSTOMER_KONTRAK_UPDATE (NO_REF, ITEM, TANGGAL, DESKRIPSI_UPDATE, CREATE_USERID, CREATE_DATE, UPDATE_USERID, UPDATE_DATE)
         VALUES (@noRef, @item, @tanggal, @deskripsi, @userid, ${NOW_WIB}, @userid, ${NOW_WIB})`,
      );
    await insertDocs(tx, noRef, item, files, userid);
    return item;
  });
}

export async function updateProgress(
  noRef: number,
  item: number,
  data: { tanggal: string; deskripsi: string },
  files: NewFile[],
  userid: string,
): Promise<boolean> {
  return inTransaction(async (tx) => {
    const r = await new sql.Request(tx)
      .input("noRef", sql.Int, noRef)
      .input("item", sql.Int, item)
      .input("tanggal", sql.Date, data.tanggal)
      .input("deskripsi", sql.VarChar(2000), data.deskripsi)
      .input("userid", sql.VarChar(50), userid)
      .query(
        `UPDATE dbo.CUSTOMER_KONTRAK_UPDATE
         SET TANGGAL = @tanggal, DESKRIPSI_UPDATE = @deskripsi, UPDATE_USERID = @userid, UPDATE_DATE = ${NOW_WIB}
         WHERE NO_REF = @noRef AND ITEM = @item`,
      );
    if (r.rowsAffected[0] === 0) return false;
    await insertDocs(tx, noRef, item, files, userid);
    return true;
  });
}
