import "server-only";
import { getPool, sql } from "@/lib/db";

// Query baca data customer.

export async function getCustomerNama(kode: string): Promise<string | null> {
  if (!kode) return null;
  const pool = await getPool();
  const r = await pool
    .request()
    .input("kode", sql.VarChar(20), kode)
    .query<{ Nama: string | null }>("SELECT Nama FROM dbo.Customer WHERE Kode = @kode");
  return r.recordset[0]?.Nama ?? null;
}

export type CustomerRow = {
  kode: string;
  nama: string;
  npwp: string | null;
  telp: string | null;
  email: string | null;
  contact: string | null;
  jumlahFaktur: number;
  totalPenjualan: number;
  piutang: number;
};

export async function getCustomers(perusahaan: string, q?: string): Promise<CustomerRow[]> {
  const pool = await getPool();
  const req = pool.request().input("p", sql.VarChar(50), perusahaan);
  let filter = "";
  if (q) {
    req.input("q", sql.NVarChar(200), `%${q}%`);
    filter = "AND (c.Kode LIKE @q OR c.Nama LIKE @q OR c.Email LIKE @q OR c.Telp LIKE @q)";
  }
  const r = await req.query<CustomerRow>(
    `SELECT c.Kode AS kode, c.Nama AS nama, c.NPWP AS npwp, c.Telp AS telp, c.Email AS email, c.Contact AS contact,
            COUNT(h.NO_REF) AS jumlahFaktur,
            COALESCE(SUM(h.NILAI_AKHIR), 0) AS totalPenjualan,
            COALESCE(SUM(CASE WHEN COALESCE(h.FLAG_LUNAS, 0) = 0
                              THEN h.NILAI_AKHIR - COALESCE(h.NILAI_DIBAYAR, 0) ELSE 0 END), 0) AS piutang
     FROM dbo.Customer c
     LEFT JOIN dbo.JUAL_HDR h ON h.CUSTOMER = c.Kode AND h.PERUSAHAAN = @p
     WHERE COALESCE(c.FLAG_CUSTOMER, 0) = 1 ${filter}
     GROUP BY c.Kode, c.Nama, c.NPWP, c.Telp, c.Email, c.Contact
     ORDER BY totalPenjualan DESC, c.Nama`,
  );
  return r.recordset.map((x) => ({ ...x, totalPenjualan: Number(x.totalPenjualan), piutang: Number(x.piutang) }));
}
