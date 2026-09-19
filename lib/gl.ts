import "server-only";
import { getPool, sql } from "@/lib/db";

// ---------- Periode ----------

export const NAMA_BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export type GlPeriode = { tahun: number; dari: number; sampai: number };

type Get = (key: string) => string | string[] | null | undefined;
const num = (get: Get, k: string) => {
  const v = get(k);
  return typeof v === "string" && /^\d+$/.test(v) ? Number(v) : NaN;
};
const bulanOr = (v: number, def: number) => (v >= 1 && v <= 12 ? v : def);

/** Periode GL dari query string (tahun, bulan dari–sampai); default tahun berjalan s/d bulan ini. */
export function parseGlPeriode(get: Get, tahunList: number[]): GlPeriode {
  const now = new Date();
  const tahunIni = now.getFullYear();
  const defaultTahun = tahunList.includes(tahunIni) ? tahunIni : (tahunList[0] ?? tahunIni);
  const tahun = tahunList.includes(num(get, "tahun")) ? num(get, "tahun") : defaultTahun;
  const dari = bulanOr(num(get, "dari"), 1);
  const sampai = bulanOr(num(get, "sampai"), tahun === tahunIni ? now.getMonth() + 1 : 12);
  return { tahun, dari: Math.min(dari, sampai), sampai: Math.max(dari, sampai) };
}

/** Satu bulan saja (neraca per akhir bulan). */
export function parseGlBulan(get: Get, tahunList: number[]): GlPeriode {
  const p = parseGlPeriode(get, tahunList);
  const bulan = bulanOr(num(get, "bulan"), p.sampai);
  return { tahun: p.tahun, dari: bulan, sampai: bulan };
}

export const labelPeriode = ({ tahun, dari, sampai }: GlPeriode) =>
  dari === sampai ? `${NAMA_BULAN[dari - 1]} ${tahun}` : `${NAMA_BULAN[dari - 1]} – ${NAMA_BULAN[sampai - 1]} ${tahun}`;

export const periodeQuery = ({ tahun, dari, sampai }: GlPeriode) => `tahun=${tahun}&dari=${dari}&sampai=${sampai}`;

/** Tahun yang punya data (saldo atau jurnal) ditambah tahun ini, terbaru dulu. */
export async function getGlTahun(perusahaan: string): Promise<number[]> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("perusahaan", sql.VarChar(50), perusahaan)
    .query<{ tahun: number }>(
      `SELECT Year AS tahun FROM dbo.GLBalnc WHERE PERUSAHAAN = @perusahaan
       UNION SELECT YEAR(TDATE) FROM dbo.TRNHDR WHERE PERUSAHAAN = @perusahaan AND TDATE IS NOT NULL`,
    );
  const set = new Set(r.recordset.map((x) => x.tahun));
  set.add(new Date().getFullYear());
  return [...set].sort((a, b) => b - a);
}

// ---------- Kolom bulanan GLBalnc ----------

// DB01..DB12 / CR01..CR12; bulan selalu integer 1–12 hasil validasi, aman disusun ke SQL
export const bln = (m: number) => String(m).padStart(2, "0");
const sumKolom = (prefix: "DB" | "CR", dari: number, sampai: number) => {
  const cols = [];
  for (let m = dari; m <= sampai; m++) cols.push(`COALESCE(b.${prefix}${bln(m)}, 0)`);
  return cols.length ? cols.join(" + ") : "0";
};
/** Saldo awal periode = saldo awal tahun + mutasi bulan-bulan sebelum `dari` (debet positif). */
const saldoAwalExpr = (dari: number) =>
  `COALESCE(b.DBBeg, 0) - COALESCE(b.CRBeg, 0) + (${sumKolom("DB", 1, dari - 1)}) - (${sumKolom("CR", 1, dari - 1)})`;

export const bulat = (n: number | null | undefined) => Math.round(Number(n ?? 0) * 100) / 100;

// ---------- Neraca saldo ----------

export type NeracaRow = {
  akun: string;
  nama: string;
  level: number;
  induk: boolean;
  saldoAwal: number;
  debet: number;
  kredit: number;
  saldoAkhir: number;
};

type SaldoDb = { akun: string; nama: string | null; level: number | null; tl: string | null; saldoAwal: number; debet: number; kredit: number };

async function querySaldo(perusahaan: string, { tahun, dari, sampai }: GlPeriode): Promise<NeracaRow[]> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("perusahaan", sql.VarChar(50), perusahaan)
    .input("tahun", sql.SmallInt, tahun)
    .query<SaldoDb>(
      `SELECT b.Account AS akun, a.Name AS nama, a.LEVEL_NUMBER AS level, a.TL AS tl,
              ${saldoAwalExpr(dari)} AS saldoAwal,
              ${sumKolom("DB", dari, sampai)} AS debet,
              ${sumKolom("CR", dari, sampai)} AS kredit
       FROM dbo.GLBalnc b
       LEFT JOIN dbo.GLAcc a ON a.PERUSAHAAN = b.PERUSAHAAN AND a.Acc = b.Account
       WHERE b.PERUSAHAAN = @perusahaan AND b.Year = @tahun
       ORDER BY b.Account`,
    );
  return r.recordset.map((x) => {
    const saldoAwal = bulat(x.saldoAwal);
    const debet = bulat(x.debet);
    const kredit = bulat(x.kredit);
    return {
      akun: x.akun,
      nama: x.nama?.trim() || "-",
      level: Math.max(1, Number(x.level ?? 1)),
      induk: x.tl === "T",
      saldoAwal,
      debet,
      kredit,
      saldoAkhir: bulat(saldoAwal + debet - kredit),
    };
  });
}

/** Neraca saldo dari GLBalnc. Akun induk (TL = 'T') sudah berisi total anak-anaknya. */
export async function getNeracaSaldo(perusahaan: string, periode: GlPeriode): Promise<NeracaRow[]> {
  const rows = await querySaldo(perusahaan, periode);
  return rows.filter((r) => r.saldoAwal !== 0 || r.debet !== 0 || r.kredit !== 0);
}

// ---------- Setup laporan (SETUP_TBL, GLSETUP) ----------

export type GlSetup = { awalAktiva: string; awalPasiva: string; awalRl: string; rlSementara: string };

/** Batas awal kelompok akun (AWAL_AKTIVA / AWAL_PASSIVA / AWAL_RL) dan akun penampung laba-rugi (GLSETUP.RLSementara). */
export async function getGlSetup(perusahaan: string): Promise<GlSetup> {
  const pool = await getPool();
  const [setup, gl] = await Promise.all([
    pool
      .request()
      .input("perusahaan", sql.VarChar(50), perusahaan)
      .query<{ PARAMETER: string; NILAI: string | null }>(
        "SELECT PARAMETER, NILAI FROM dbo.SETUP_TBL WHERE PERUSAHAAN = @perusahaan AND PARAMETER IN ('AWAL_AKTIVA', 'AWAL_PASSIVA', 'AWAL_PASIVA', 'AWAL_RL')",
      ),
    pool
      .request()
      .input("perusahaan", sql.VarChar(50), perusahaan)
      .query<{ RLSementara: string | null }>("SELECT RLSementara FROM dbo.GLSETUP WHERE PERUSAHAAN = @perusahaan"),
  ]);
  const p = Object.fromEntries(setup.recordset.map((r) => [r.PARAMETER.toUpperCase(), (r.NILAI ?? "").trim()]));
  return {
    awalAktiva: p.AWAL_AKTIVA || "1",
    awalPasiva: p.AWAL_PASSIVA || p.AWAL_PASIVA || "4",
    awalRl: p.AWAL_RL || "6",
    rlSementara: (gl.recordset[0]?.RLSementara ?? "").trim(),
  };
}

/** Akun default "Jurnal dari Foto": SETUP_TBL IMPORT_DEBET / IMPORT_CREDIT per perusahaan (kosong jika belum diset). */
export async function getImportDefault(perusahaan: string): Promise<{ debet: string; kredit: string }> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("perusahaan", sql.VarChar(50), perusahaan)
    .query<{ PARAMETER: string; NILAI: string | null }>(
      "SELECT PARAMETER, NILAI FROM dbo.SETUP_TBL WHERE PERUSAHAAN = @perusahaan AND PARAMETER IN ('IMPORT_DEBET', 'IMPORT_CREDIT')",
    );
  const p = Object.fromEntries(r.recordset.map((x) => [x.PARAMETER.toUpperCase(), (x.NILAI ?? "").trim()]));
  return { debet: p.IMPORT_DEBET ?? "", kredit: p.IMPORT_CREDIT ?? "" };
}

// Kode akun dibandingkan sebagai string, sama seperti batas di SETUP_TBL ('1', '4', '6')
const dalam = (akun: string, awal: string, sampai?: string) => akun >= awal && (sampai === undefined || akun < sampai);

// ---------- Rugi laba ----------

export type RugiLabaRow = { akun: string; nama: string; level: number; induk: boolean; periode: number; tahunBerjalan: number };
export type RugiLaba = { rows: RugiLabaRow[]; totalPeriode: number; totalTahunBerjalan: number };

/** Rugi laba: akun mulai AWAL_RL, kecuali akun penampung (RLSementara). Nilai = kredit − debet, jadi laba positif. */
export async function getRugiLaba(perusahaan: string, periode: GlPeriode): Promise<RugiLaba> {
  const setup = await getGlSetup(perusahaan);
  const [bulanIni, ytd] = await Promise.all([
    querySaldo(perusahaan, periode),
    querySaldo(perusahaan, { ...periode, dari: 1 }),
  ]);
  const ytdMap = new Map(ytd.map((r) => [r.akun, r]));
  const rows = bulanIni
    .filter((r) => dalam(r.akun, setup.awalRl) && r.akun !== setup.rlSementara)
    .map((r) => ({
      akun: r.akun,
      nama: r.nama,
      level: r.level,
      induk: r.induk,
      periode: bulat(r.kredit - r.debet),
      tahunBerjalan: bulat((ytdMap.get(r.akun)?.kredit ?? 0) - (ytdMap.get(r.akun)?.debet ?? 0)),
    }))
    .filter((r) => r.periode !== 0 || r.tahunBerjalan !== 0);
  const leaf = rows.filter((r) => !r.induk);
  return {
    rows,
    totalPeriode: bulat(leaf.reduce((s, r) => s + r.periode, 0)),
    totalTahunBerjalan: bulat(leaf.reduce((s, r) => s + r.tahunBerjalan, 0)),
  };
}

// ---------- Neraca ----------

export type NeracaSisiRow = { akun: string; nama: string; level: number; induk: boolean; saldo: number };
export type Neraca = {
  aktiva: NeracaSisiRow[];
  pasiva: NeracaSisiRow[];
  totalAktiva: number;
  totalPasiva: number;
  /** Laba/rugi tahun berjalan yang belum dipindahkan oleh jurnal tutup bulan (kredit positif) */
  labaBerjalan: number;
};

/** Neraca per akhir bulan `periode.sampai`. Aktiva debet positif, pasiva kredit positif. */
export async function getNeraca(perusahaan: string, periode: GlPeriode): Promise<Neraca> {
  const setup = await getGlSetup(perusahaan);
  const rows = await querySaldo(perusahaan, { ...periode, dari: 1 });
  const sisi = (awal: string, sampai: string, tanda: 1 | -1) =>
    rows
      .filter((r) => dalam(r.akun, awal, sampai) && r.saldoAkhir !== 0)
      .map((r) => ({ akun: r.akun, nama: r.nama, level: r.level, induk: r.induk, saldo: bulat(r.saldoAkhir * tanda) }));
  const aktiva = sisi(setup.awalAktiva, setup.awalPasiva, 1);
  const pasiva = sisi(setup.awalPasiva, setup.awalRl, -1);
  const total = (xs: NeracaSisiRow[]) => bulat(xs.filter((r) => !r.induk).reduce((s, r) => s + r.saldo, 0));
  // Semua akun rugi laba termasuk RLSementara: setelah tutup bulan jumlahnya nol
  const labaBerjalan = bulat(rows.filter((r) => !r.induk && dalam(r.akun, setup.awalRl)).reduce((s, r) => s - r.saldoAkhir, 0));
  return { aktiva, pasiva, totalAktiva: total(aktiva), totalPasiva: bulat(total(pasiva) + labaBerjalan), labaBerjalan };
}

// ---------- Akun ----------

export type GlAkun = { akun: string; nama: string; induk: boolean };

export async function getGlAkun(perusahaan: string, akun: string): Promise<GlAkun | null> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("perusahaan", sql.VarChar(50), perusahaan)
    .input("akun", sql.VarChar(20), akun)
    .query<{ akun: string; nama: string | null; tl: string | null }>(
      // Ada akun di GLBalnc yang tidak terdaftar di GLAcc, jadi cek keduanya
      `SELECT TOP 1 akun, nama, tl FROM (
         SELECT Acc AS akun, Name AS nama, TL AS tl, 0 AS urut FROM dbo.GLAcc WHERE PERUSAHAAN = @perusahaan AND Acc = @akun
         UNION ALL
         SELECT Account, NULL, NULL, 1 FROM dbo.GLBalnc WHERE PERUSAHAAN = @perusahaan AND Account = @akun
       ) x ORDER BY urut`,
    );
  const x = r.recordset[0];
  return x ? { akun: x.akun, nama: x.nama?.trim() || "-", induk: x.tl === "T" } : null;
}

export type DaftarAkun = { akun: string; nama: string; induk: boolean };

/** Semua akun untuk pilihan buku besar: GLAcc perusahaan tsb ditambah akun yang hanya ada di GLBalnc. */
export async function getDaftarAkun(perusahaan: string): Promise<DaftarAkun[]> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("perusahaan", sql.VarChar(50), perusahaan)
    .query<{ akun: string; nama: string | null; tl: string | null }>(
      `SELECT Acc AS akun, Name AS nama, TL AS tl FROM dbo.GLAcc WHERE PERUSAHAAN = @perusahaan
       UNION
       SELECT b.Account, NULL, NULL FROM dbo.GLBalnc b
       WHERE b.PERUSAHAAN = @perusahaan AND NOT EXISTS (SELECT 1 FROM dbo.GLAcc a WHERE a.PERUSAHAAN = @perusahaan AND a.Acc = b.Account)
       ORDER BY akun`,
    );
  return r.recordset.map((x) => ({ akun: x.akun, nama: x.nama?.trim() || "-", induk: x.tl === "T" }));
}

export type AkunOption = { akun: string; nama: string; rl: boolean };

/** Akun yang boleh dipakai jurnal (TL = '0'), urut kode. `rl` = akun rugi laba (untuk default cost center). */
export async function getAkunTransaksi(perusahaan: string): Promise<AkunOption[]> {
  const [setup, pool] = await Promise.all([getGlSetup(perusahaan), getPool()]);
  const r = await pool
    .request()
    .input("perusahaan", sql.VarChar(50), perusahaan)
    .query<{ Acc: string; Name: string | null }>(
      "SELECT Acc, Name FROM dbo.GLAcc WHERE PERUSAHAAN = @perusahaan AND COALESCE(TL, '0') <> 'T' ORDER BY Acc",
    );
  return r.recordset.map((x) => ({ akun: x.Acc, nama: x.Name?.trim() || "-", rl: dalam(x.Acc, setup.awalRl) }));
}

export type CostCenter = { kode: string; nama: string };

export async function getCostCenters(perusahaan: string): Promise<CostCenter[]> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("perusahaan", sql.VarChar(50), perusahaan)
    .query<{ KODE: string; NAMA: string | null }>("SELECT KODE, NAMA FROM dbo.COST_CENTER WHERE PERUSAHAAN = @perusahaan ORDER BY KODE");
  return r.recordset.map((x) => ({ kode: x.KODE, nama: x.NAMA?.trim() || x.KODE }));
}

// ---------- Buku besar ----------

export type BukuBesarRow = {
  noRef: number;
  tcode: string;
  tanggal: string;
  keterangan: string;
  debet: number;
  kredit: number;
  saldo: number;
};

export type BukuBesarAkun = {
  akun: string;
  nama: string;
  saldoAwal: number;
  debet: number;
  kredit: number;
  saldoAkhir: number;
  rows: BukuBesarRow[];
};

/** Rentang akun dan rentang bulan/tahun (boleh lintas tahun). */
export type BukuBesarFilter = {
  akunDari: string;
  akunSampai: string;
  tahunDari: number;
  bulanDari: number;
  tahunSampai: number;
  bulanSampai: number;
};

/** Filter buku besar dari query string; `akun` (satu akun, dari link laporan lain) mengisi dari & sampai sekaligus. */
export function parseBukuBesarFilter(get: Get, tahunList: number[]): BukuBesarFilter {
  const str = (k: string) => {
    const v = get(k);
    return typeof v === "string" ? v.trim().slice(0, 20) : "";
  };
  const now = new Date();
  const tahunIni = tahunList.includes(now.getFullYear()) ? now.getFullYear() : (tahunList[0] ?? now.getFullYear());
  const tahun = (k: string, def: number) => (tahunList.includes(num(get, k)) ? num(get, k) : def);

  const satu = str("akun");
  let akunDari = str("akunDari") || satu;
  let akunSampai = str("akunSampai") || satu || akunDari;
  if (akunDari && akunSampai && akunDari > akunSampai) [akunDari, akunSampai] = [akunSampai, akunDari];

  // Link dari laporan lain memakai tahun/dari/sampai; form buku besar memakai tahunDari/bulanDari/tahunSampai/bulanSampai
  let tahunDari = tahun("tahunDari", tahun("tahun", tahunIni));
  let bulanDari = bulanOr(num(get, "bulanDari"), bulanOr(num(get, "dari"), 1));
  let tahunSampai = tahun("tahunSampai", tahunDari);
  let bulanSampai = bulanOr(num(get, "bulanSampai"), bulanOr(num(get, "sampai"), tahunSampai === now.getFullYear() ? now.getMonth() + 1 : 12));
  if (tahunDari * 100 + bulanDari > tahunSampai * 100 + bulanSampai)
    [tahunDari, bulanDari, tahunSampai, bulanSampai] = [tahunSampai, bulanSampai, tahunDari, bulanDari];
  return { akunDari, akunSampai, tahunDari, bulanDari, tahunSampai, bulanSampai };
}

export const labelBukuBesar = (f: BukuBesarFilter) =>
  f.tahunDari === f.tahunSampai
    ? labelPeriode({ tahun: f.tahunDari, dari: f.bulanDari, sampai: f.bulanSampai })
    : `${NAMA_BULAN[f.bulanDari - 1]} ${f.tahunDari} – ${NAMA_BULAN[f.bulanSampai - 1]} ${f.tahunSampai}`;

export const bukuBesarQuery = (f: BukuBesarFilter) =>
  `akunDari=${encodeURIComponent(f.akunDari)}&akunSampai=${encodeURIComponent(f.akunSampai)}&tahunDari=${f.tahunDari}&bulanDari=${f.bulanDari}&tahunSampai=${f.tahunSampai}&bulanSampai=${f.bulanSampai}`;

/** Batas tanggal periode sebagai string YYYY-MM-DD (awal inklusif, akhir eksklusif) agar tidak bergeser zona waktu. */
export function batasPeriode({ tahun, dari, sampai }: GlPeriode) {
  const mulai = `${tahun}-${bln(dari)}-01`;
  const akhir = sampai === 12 ? `${tahun + 1}-01-01` : `${tahun}-${bln(sampai + 1)}-01`;
  return { mulai, akhir };
}

const toDateStr = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/**
 * Buku besar rentang akun (akun transaksi saja; akun induk tidak ikut karena sub-akunnya sudah tampil sendiri).
 * Saldo awal dari GLBalnc tahun awal + mutasi bulan sebelum `bulanDari`; detail dari TRNDTL sampai akhir `bulanSampai`.
 */
export async function getBukuBesarRentang(perusahaan: string, f: BukuBesarFilter): Promise<BukuBesarAkun[]> {
  if (!f.akunDari || !f.akunSampai) return [];
  const pool = await getPool();
  const { mulai } = batasPeriode({ tahun: f.tahunDari, dari: f.bulanDari, sampai: f.bulanDari });
  const { akhir } = batasPeriode({ tahun: f.tahunSampai, dari: f.bulanSampai, sampai: f.bulanSampai });
  const bind = (r: import("mssql").Request) =>
    r.input("perusahaan", sql.VarChar(50), perusahaan).input("dari", sql.VarChar(20), f.akunDari).input("sampai", sql.VarChar(20), f.akunSampai);

  const [daftar, awal, trx] = await Promise.all([
    getDaftarAkun(perusahaan),
    bind(pool.request())
      .input("tahun", sql.SmallInt, f.tahunDari)
      .query<{ akun: string; saldoAwal: number }>(
        `SELECT b.Account AS akun, ${saldoAwalExpr(f.bulanDari)} AS saldoAwal
         FROM dbo.GLBalnc b WHERE b.PERUSAHAAN = @perusahaan AND b.Year = @tahun AND b.Account BETWEEN @dari AND @sampai`,
      ),
    bind(pool.request())
      .input("mulai", sql.VarChar(10), mulai)
      .input("akhir", sql.VarChar(10), akhir)
      .query<{ NO_REF: number; TCODE: string | null; TDATE: Date | null; ACCOUNT: string; REMARKS: string | null; REF1: string | null; AMTDB: number | null; AMTCR: number | null }>(
        `SELECT h.NO_REF, h.TCODE, h.TDATE, d.ACCOUNT, h.REMARKS, d.REF1, d.AMTDB, d.AMTCR
         FROM dbo.TRNHDR h
         JOIN dbo.TRNDTL d ON d.NO_REF = h.NO_REF
         WHERE h.PERUSAHAAN = @perusahaan AND d.ACCOUNT BETWEEN @dari AND @sampai
           AND h.TDATE >= CONVERT(date, @mulai) AND h.TDATE < CONVERT(date, @akhir)
         ORDER BY d.ACCOUNT, h.TDATE, h.NO_REF, d.VIRTKEY`,
      ),
  ]);

  const awalMap = new Map(awal.recordset.map((x) => [x.akun, bulat(x.saldoAwal)]));
  const trxMap = new Map<string, (typeof trx.recordset)[number][]>();
  for (const r of trx.recordset) {
    const list = trxMap.get(r.ACCOUNT) ?? [];
    list.push(r);
    trxMap.set(r.ACCOUNT, list);
  }
  // Akun yang ada di daftar (bukan induk) ditambah akun asing yang muncul di jurnal/saldo
  const info = new Map(daftar.map((a) => [a.akun, a]));
  const kode = new Set<string>([...daftar.filter((a) => !a.induk).map((a) => a.akun), ...trxMap.keys(), ...awalMap.keys()]);

  return [...kode]
    .filter((k) => k >= f.akunDari && k <= f.akunSampai && !info.get(k)?.induk)
    .sort()
    .map((akun) => {
      const saldoAwal = awalMap.get(akun) ?? 0;
      let saldo = saldoAwal;
      const rows = (trxMap.get(akun) ?? []).map((r) => {
        const debet = bulat(r.AMTDB);
        const kredit = bulat(r.AMTCR);
        saldo = bulat(saldo + debet - kredit);
        return { noRef: r.NO_REF, tcode: r.TCODE ?? "", tanggal: toDateStr(r.TDATE), keterangan: r.REF1?.trim() || r.REMARKS?.trim() || "", debet, kredit, saldo };
      });
      const debet = bulat(rows.reduce((s, r) => s + r.debet, 0));
      const kredit = bulat(rows.reduce((s, r) => s + r.kredit, 0));
      return { akun, nama: info.get(akun)?.nama ?? "-", saldoAwal, debet, kredit, saldoAkhir: bulat(saldoAwal + debet - kredit), rows };
    })
    .filter((a) => a.saldoAwal !== 0 || a.rows.length > 0);
}

// ---------- Jurnal (baca) ----------

export type JurnalListRow = {
  noRef: number;
  tcode: string;
  tanggal: string;
  jenis: string;
  keterangan: string;
  total: number;
  fotoCount: number;
};

/** Daftar jurnal satu periode, terbaru dulu. `q` mencari di nomor jurnal, pihak ketiga, dan keterangan baris. */
export async function getJurnalList(perusahaan: string, periode: GlPeriode, q: string): Promise<JurnalListRow[]> {
  const pool = await getPool();
  const { mulai, akhir } = batasPeriode(periode);
  const req = pool
    .request()
    .input("perusahaan", sql.VarChar(50), perusahaan)
    .input("mulai", sql.VarChar(10), mulai)
    .input("akhir", sql.VarChar(10), akhir);
  let filter = "";
  if (q) {
    req.input("q", sql.VarChar(100), `%${q}%`);
    filter = `AND (h.TCODE LIKE @q OR h.REMARKS LIKE @q OR EXISTS (SELECT 1 FROM dbo.TRNDTL x WHERE x.NO_REF = h.NO_REF AND x.REF1 LIKE @q))`;
  }
  const r = await req.query<{ NO_REF: number; TCODE: string | null; TDATE: Date | null; JENIS: string | null; REMARKS: string | null; REF1: string | null; total: number | null; foto: number }>(
    `SELECT h.NO_REF, h.TCODE, h.TDATE, h.JENIS, h.REMARKS,
            (SELECT TOP 1 REF1 FROM dbo.TRNDTL x WHERE x.NO_REF = h.NO_REF AND COALESCE(x.REF1, '') <> '' ORDER BY x.VIRTKEY) AS REF1,
            (SELECT SUM(AMTDB) FROM dbo.TRNDTL x WHERE x.NO_REF = h.NO_REF) AS total,
            (SELECT COUNT(*) FROM dbo.DOC x WHERE x.NO_REF = h.NO_REF) AS foto
     FROM dbo.TRNHDR h
     WHERE h.PERUSAHAAN = @perusahaan AND h.TDATE >= CONVERT(date, @mulai) AND h.TDATE < CONVERT(date, @akhir) ${filter}
     ORDER BY h.TDATE DESC, h.NO_REF DESC`,
  );
  return r.recordset.map((x) => ({
    noRef: x.NO_REF,
    tcode: x.TCODE ?? "",
    tanggal: toDateStr(x.TDATE),
    jenis: x.JENIS?.trim() ?? "",
    keterangan: x.REMARKS?.trim() || x.REF1?.trim() || "",
    total: bulat(x.total),
    fotoCount: Number(x.foto ?? 0),
  }));
}

export type InfoCopy = { akunBiaya: string; namaBiaya: string; foto: { item: number; ext: string } | null };

/**
 * Info tambahan daftar Copy Jurnal per NO_REF: satu account biaya (baris debet pertama dengan akun
 * rugi laba, selain akun penampung RLSementara) dan foto pertama di DOC.
 */
export async function getInfoCopy(perusahaan: string, periode: GlPeriode): Promise<Map<number, InfoCopy>> {
  const [setup, pool] = await Promise.all([getGlSetup(perusahaan), getPool()]);
  const { mulai, akhir } = batasPeriode(periode);
  const r = await pool
    .request()
    .input("perusahaan", sql.VarChar(50), perusahaan)
    .input("mulai", sql.VarChar(10), mulai)
    .input("akhir", sql.VarChar(10), akhir)
    .input("awalRl", sql.VarChar(20), setup.awalRl)
    .input("rlSementara", sql.VarChar(20), setup.rlSementara)
    .query<{ NO_REF: number; ACCOUNT: string | null; NAMA: string | null; ITEM: number | null; EXT: string | null }>(
      `SELECT h.NO_REF, x.ACCOUNT, a.Name AS NAMA, f.ITEM, f.EXT
       FROM dbo.TRNHDR h
       OUTER APPLY (
         SELECT TOP 1 d.ACCOUNT FROM dbo.TRNDTL d
         WHERE d.NO_REF = h.NO_REF AND d.ACCOUNT >= @awalRl AND d.ACCOUNT <> @rlSementara AND d.AMTDB > 0
         ORDER BY d.VIRTKEY
       ) x
       LEFT JOIN dbo.GLAcc a ON a.PERUSAHAAN = h.PERUSAHAAN AND a.Acc = x.ACCOUNT
       OUTER APPLY (SELECT TOP 1 ITEM, EXT FROM dbo.DOC WHERE NO_REF = h.NO_REF ORDER BY ITEM) f
       WHERE h.PERUSAHAAN = @perusahaan AND h.TDATE >= CONVERT(date, @mulai) AND h.TDATE < CONVERT(date, @akhir)`,
    );
  return new Map(
    r.recordset.map((x) => [
      x.NO_REF,
      {
        akunBiaya: x.ACCOUNT ?? "",
        namaBiaya: x.NAMA?.trim() ?? "",
        // Foto dari aplikasi desktop disimpan tanpa EXT (isinya JPG)
        foto: x.ITEM !== null ? { item: x.ITEM, ext: (x.EXT ?? "jpg").toLowerCase() } : null,
      },
    ]),
  );
}

export type JurnalLine = { akun: string; nama: string; keterangan: string; cc: string; debet: number; kredit: number };
export type JurnalDoc = { item: number; ext: string; filesize: number; uploadUser: string | null; uploadDate: Date | null };
export type Jurnal = {
  noRef: number;
  tcode: string;
  tanggal: string;
  jenis: string;
  remarks: string;
  createUser: string | null;
  createDate: Date | null;
  updateUser: string | null;
  updateDate: Date | null;
  lines: JurnalLine[];
  docs: JurnalDoc[];
};

export async function getJurnal(perusahaan: string, noRef: number): Promise<Jurnal | null> {
  const pool = await getPool();
  const hdr = await pool
    .request()
    .input("perusahaan", sql.VarChar(50), perusahaan)
    .input("noRef", sql.Int, noRef)
    .query<{ NO_REF: number; TCODE: string | null; TDATE: Date | null; JENIS: string | null; REMARKS: string | null; CREATE_USERID: string | null; CREATE_DATE: Date | null; UPDATE_USERID: string | null; UPDATE_DATE: Date | null }>(
      `SELECT NO_REF, TCODE, TDATE, JENIS, REMARKS, CREATE_USERID, CREATE_DATE, UPDATE_USERID, UPDATE_DATE
       FROM dbo.TRNHDR WHERE PERUSAHAAN = @perusahaan AND NO_REF = @noRef`,
    );
  const h = hdr.recordset[0];
  if (!h) return null;

  const [dtl, docs] = await Promise.all([
    pool
      .request()
      .input("perusahaan", sql.VarChar(50), perusahaan)
      .input("noRef", sql.Int, noRef)
      .query<{ ACCOUNT: string; NAMA: string | null; REF1: string | null; CC: string | null; AMTDB: number | null; AMTCR: number | null }>(
        `SELECT d.ACCOUNT, a.Name AS NAMA, d.REF1, d.CC, d.AMTDB, d.AMTCR
         FROM dbo.TRNDTL d
         LEFT JOIN dbo.GLAcc a ON a.PERUSAHAAN = @perusahaan AND a.Acc = d.ACCOUNT
         WHERE d.NO_REF = @noRef ORDER BY d.VIRTKEY`,
      ),
    // Kolom DOKUMEN sengaja tidak di-SELECT agar ringan
    pool
      .request()
      .input("noRef", sql.Int, noRef)
      .query<{ ITEM: number; EXT: string | null; FILESIZE: number | string | null; UPLOAD_USERID: string | null; UPLOAD_DATE: Date | null }>(
        "SELECT ITEM, EXT, COALESCE(FILESIZE, DATALENGTH(DOKUMEN)) AS FILESIZE, UPLOAD_USERID, UPLOAD_DATE FROM dbo.DOC WHERE NO_REF = @noRef ORDER BY ITEM",
      ),
  ]);

  return {
    noRef: h.NO_REF,
    tcode: h.TCODE ?? "",
    tanggal: toDateStr(h.TDATE),
    jenis: h.JENIS?.trim() ?? "",
    remarks: h.REMARKS?.trim() ?? "",
    createUser: h.CREATE_USERID,
    createDate: h.CREATE_DATE,
    updateUser: h.UPDATE_USERID,
    updateDate: h.UPDATE_DATE,
    lines: dtl.recordset.map((d) => ({
      akun: d.ACCOUNT,
      nama: d.NAMA?.trim() || "-",
      keterangan: d.REF1?.trim() ?? "",
      cc: d.CC?.trim() ?? "",
      debet: bulat(d.AMTDB),
      kredit: bulat(d.AMTCR),
    })),
    docs: docs.recordset.map((d) => ({
      item: d.ITEM,
      // Foto dari aplikasi desktop disimpan tanpa EXT (isinya JPG)
      ext: (d.EXT ?? "jpg").toLowerCase(),
      filesize: Number(d.FILESIZE ?? 0),
      uploadUser: d.UPLOAD_USERID,
      uploadDate: d.UPLOAD_DATE,
    })),
  };
}

// ---------- Periode aktif (SETUPBULAN) ----------

/** Jurnal boleh diinput/diubah/dihapus hanya jika bulan tanggalnya ACTIVE = 1 di SETUPBULAN perusahaan tsb. */
export async function isPeriodeAktif(perusahaan: string, tanggal: string): Promise<boolean> {
  const pool = await getPool();
  const r = await pool
    .request()
    .input("perusahaan", sql.VarChar(50), perusahaan)
    .input("tanggal", sql.VarChar(10), tanggal)
    .query<{ ok: number }>(
      `SELECT TOP 1 1 AS ok FROM dbo.SETUPBULAN
       WHERE PERUSAHAAN = @perusahaan AND ACTIVE = 1
         AND YEAR(PERIODE) = YEAR(CONVERT(date, @tanggal)) AND MONTH(PERIODE) = MONTH(CONVERT(date, @tanggal))`,
    );
  return r.recordset.length > 0;
}
