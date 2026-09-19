import "server-only";
import { getPool, sql } from "@/lib/db";

// Dashboard (customer, kontrak, invoice) khusus untuk PT. SOS; menu GL berlaku untuk semua perusahaan user
export const COMPANY_KODE = "SOS";

export type Company = { kode: string; nama: string };

/** PT. SOS jika user terdaftar untuk SOS di USER_PERUSAHAAN, selain itu null. */
export async function getCompany(userid: string): Promise<Company | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("userid", sql.VarChar(50), userid)
    .input("kode", sql.VarChar(50), COMPANY_KODE)
    .query<Company>(
      `SELECT TOP 1 up.PERUSAHAAN AS kode, COALESCE(cs.NAMA, up.PERUSAHAAN) AS nama
       FROM dbo.USER_PERUSAHAAN up
       LEFT JOIN dbo.COMPANY_SETUP cs ON cs.KODE_COMPANY = up.PERUSAHAAN
       WHERE UPPER(up.USERID) = UPPER(@userid) AND up.PERUSAHAAN = @kode`,
    );
  return result.recordset[0] ?? null;
}

/** Semua perusahaan yang boleh diakses user (USER_PERUSAHAAN), urut kode. */
export async function getUserCompanies(userid: string): Promise<Company[]> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input("userid", sql.VarChar(50), userid)
    .query<Company>(
      `SELECT DISTINCT up.PERUSAHAAN AS kode, COALESCE(cs.NAMA, up.PERUSAHAAN) AS nama
       FROM dbo.USER_PERUSAHAAN up
       LEFT JOIN dbo.COMPANY_SETUP cs ON cs.KODE_COMPANY = up.PERUSAHAAN
       WHERE UPPER(up.USERID) = UPPER(@userid)
       ORDER BY up.PERUSAHAAN`,
    );
  return result.recordset;
}
