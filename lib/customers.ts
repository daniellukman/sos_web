import "server-only";
import { getPool, sql } from "@/lib/db";

// Batas panjang mengikuti kolom dbo.Customer
export const CUSTOMER_FIELDS = {
  kode: { column: "Kode", max: 20 },
  nama: { column: "Nama", max: 300 },
  affiliasi: { column: "Affiliasi", max: 10 },
  npwp: { column: "NPWP", max: 50 },
  noKtp: { column: "NO_KTP", max: 50 },
  telp: { column: "Telp", max: 50 },
  email: { column: "Email", max: 100 },
  fax: { column: "Fax", max: 50 },
  contact: { column: "Contact", max: 100 },
  namaPpn: { column: "NAMA_PPN", max: 300 },
  alamatPpn1: { column: "ALAMAT_PPN1", max: 200 },
  alamatPpn2: { column: "ALAMAT_PPN2", max: 200 },
  alamatPpn3: { column: "ALAMAT_PPN3", max: 200 },
  bank: { column: "BANK", max: 100 },
  noRekening: { column: "NO_REKENING", max: 100 },
  namaRekening: { column: "NAMA_REKENING", max: 100 },
} as const;

export type CustomerTextField = keyof typeof CUSTOMER_FIELDS;
export const FLAG_FIELDS = ["pkp", "flagCustomer", "flagSupplier", "flagMitra", "flagSales"] as const;
export type CustomerFlagField = (typeof FLAG_FIELDS)[number];

export type CustomerInput = Record<CustomerTextField, string> & Record<CustomerFlagField, boolean>;

const FLAG_COLUMNS: Record<CustomerFlagField, string> = {
  pkp: "PKP",
  flagCustomer: "FLAG_CUSTOMER",
  flagSupplier: "FLAG_SUPPLIER",
  flagMitra: "FLAG_MITRA",
  flagSales: "FLAG_SALES",
};

// Waktu lokal WIB, sama seperti data yang diinput dari aplikasi desktop
const NOW_WIB = "CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'SE Asia Standard Time' AS datetime)";

export async function getCustomer(kode: string): Promise<CustomerInput | null> {
  const pool = await getPool();
  const cols = [
    ...Object.entries(CUSTOMER_FIELDS).map(([k, f]) => `${f.column} AS ${k}`),
    ...Object.entries(FLAG_COLUMNS).map(([k, c]) => `${c} AS ${k}`),
  ].join(", ");
  const r = await pool
    .request()
    .input("kode", sql.VarChar(20), kode)
    .query(`SELECT ${cols} FROM dbo.Customer WHERE Kode = @kode`);
  const row = r.recordset[0];
  if (!row) return null;

  const result = {} as CustomerInput;
  for (const k of Object.keys(CUSTOMER_FIELDS) as CustomerTextField[]) result[k] = row[k] ?? "";
  for (const k of FLAG_FIELDS) result[k] = Boolean(Number(row[k] ?? 0));
  return result;
}

/** Saran kode customer berikutnya: V + 2 digit tahun + urutan (mis. V2601). */
export async function suggestKode(): Promise<string> {
  const prefix = `V${String(new Date().getFullYear()).slice(-2)}`;
  const pool = await getPool();
  const r = await pool
    .request()
    .input("pattern", sql.VarChar(20), `${prefix}%`)
    .query<{ Kode: string }>("SELECT Kode FROM dbo.Customer WHERE Kode LIKE @pattern");
  const max = r.recordset.reduce((m, { Kode }) => {
    const n = Number(Kode.slice(prefix.length));
    return Number.isInteger(n) && n > m ? n : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(2, "0")}`;
}

function bindInput(req: import("mssql").Request, data: CustomerInput) {
  for (const [k, f] of Object.entries(CUSTOMER_FIELDS)) {
    const v = data[k as CustomerTextField];
    req.input(k, sql.VarChar(f.max), v === "" ? null : v);
  }
  req.input("pkp", sql.Bit, data.pkp);
  for (const k of FLAG_FIELDS.slice(1)) req.input(k, sql.Int, data[k] ? 1 : 0);
  return req;
}

export async function insertCustomer(data: CustomerInput, userid: string) {
  const pool = await getPool();
  const cols = [...Object.values(CUSTOMER_FIELDS).map((f) => f.column), ...Object.values(FLAG_COLUMNS)];
  const params = [...Object.keys(CUSTOMER_FIELDS), ...FLAG_FIELDS].map((k) => `@${k}`);
  await bindInput(pool.request(), data)
    .input("userid", sql.VarChar(50), userid)
    .query(
      `INSERT INTO dbo.Customer (${cols.join(", ")}, CREATE_USERID, CREATE_DATE, UPDATE_USERID, UPDATE_DATE)
       VALUES (${params.join(", ")}, @userid, ${NOW_WIB}, @userid, ${NOW_WIB})`,
    );
}

export async function updateCustomer(data: CustomerInput, userid: string) {
  const pool = await getPool();
  const sets = [
    ...Object.entries(CUSTOMER_FIELDS)
      .filter(([k]) => k !== "kode")
      .map(([k, f]) => `${f.column} = @${k}`),
    ...Object.entries(FLAG_COLUMNS).map(([k, c]) => `${c} = @${k}`),
  ];
  const r = await bindInput(pool.request(), data)
    .input("userid", sql.VarChar(50), userid)
    .query(
      `UPDATE dbo.Customer SET ${sets.join(", ")}, UPDATE_USERID = @userid, UPDATE_DATE = ${NOW_WIB}
       WHERE Kode = @kode`,
    );
  return r.rowsAffected[0] > 0;
}
