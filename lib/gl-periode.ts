import "server-only";
import { getPool, sql } from "@/lib/db";

// Setup periode GL (tabel SETUPBULAN). PERIODE = tanggal awal bulan; ACTIVE = 1 berarti jurnal
// di bulan itu boleh diinput/diubah/dihapus.

export type SetupPeriode = { tahun: number; bulan: number; periode: string; active: boolean };

const bln = (m: number) => String(m).padStart(2, "0");

export async function getSetupPeriode(perusahaan: string): Promise<SetupPeriode[]> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("perusahaan", sql.VarChar(50), perusahaan)
    .query<{ PERIODE: Date; ACTIVE: boolean }>("SELECT PERIODE, ACTIVE FROM dbo.SETUPBULAN WHERE PERUSAHAAN = @perusahaan ORDER BY PERIODE");
  return r.recordset.map((x) => ({
    tahun: x.PERIODE.getUTCFullYear(),
    bulan: x.PERIODE.getUTCMonth() + 1,
    periode: x.PERIODE.toISOString().slice(0, 10),
    active: !!x.ACTIVE,
  }));
}

/**
 * Tambah bulan-bulan yang belum ada (satu baris per bulan, PERIODE = tanggal 1).
 * Bulan yang sudah ada dilewati; dicek per tahun+bulan karena ada data lama yang PERIODE-nya bukan tanggal 1.
 */
export async function tambahPeriode(perusahaan: string, tahun: number, bulanList: number[], active: boolean): Promise<number> {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    let n = 0;
    for (const bulan of bulanList) {
      const r = await new sql.Request(tx)
        .input("perusahaan", sql.VarChar(50), perusahaan)
        .input("tahun", sql.Int, tahun)
        .input("bulan", sql.Int, bulan)
        .input("periode", sql.VarChar(10), `${tahun}-${bln(bulan)}-01`)
        .input("active", sql.Bit, active)
        .query(
          `IF NOT EXISTS (SELECT 1 FROM dbo.SETUPBULAN WITH (UPDLOCK, HOLDLOCK)
                          WHERE PERUSAHAAN = @perusahaan AND YEAR(PERIODE) = @tahun AND MONTH(PERIODE) = @bulan)
             INSERT INTO dbo.SETUPBULAN (PERUSAHAAN, PERIODE, ACTIVE) VALUES (@perusahaan, CONVERT(datetime, @periode), @active)`,
        );
      n += r.rowsAffected[0] ?? 0;
    }
    await tx.commit();
    return n;
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

/** Ubah status aktif satu bulan. false jika bulan itu belum ada di SETUPBULAN. */
export async function setPeriodeAktif(perusahaan: string, tahun: number, bulan: number, active: boolean): Promise<boolean> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("perusahaan", sql.VarChar(50), perusahaan)
    .input("tahun", sql.Int, tahun)
    .input("bulan", sql.Int, bulan)
    .input("active", sql.Bit, active)
    .query("UPDATE dbo.SETUPBULAN SET ACTIVE = @active WHERE PERUSAHAAN = @perusahaan AND YEAR(PERIODE) = @tahun AND MONTH(PERIODE) = @bulan");
  return (r.rowsAffected[0] ?? 0) > 0;
}
