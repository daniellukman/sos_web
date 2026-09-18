import sql from "mssql";

const config: sql.config = {
  server: process.env.AZURE_SQL_SERVER ?? "",
  database: process.env.AZURE_SQL_DATABASE ?? "",
  user: process.env.AZURE_SQL_USER ?? "",
  password: process.env.AZURE_SQL_PASSWORD ?? "",
  options: { encrypt: true, trustServerCertificate: false },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
  // Azure SQL serverless bisa "tidur" dan butuh waktu untuk bangun
  connectionTimeout: 60000,
  // Cukup lama untuk upload dokumen beberapa MB ke kolom DOKUMEN
  requestTimeout: 120000,
};

// Simpan pool di globalThis agar tidak membuat koneksi baru setiap hot reload
const globalForDb = globalThis as unknown as { sqlPool?: Promise<sql.ConnectionPool> };

export function getPool(): Promise<sql.ConnectionPool> {
  if (!globalForDb.sqlPool) {
    globalForDb.sqlPool = new sql.ConnectionPool(config).connect().catch((err) => {
      globalForDb.sqlPool = undefined;
      throw err;
    });
  }
  return globalForDb.sqlPool;
}

export { sql };
