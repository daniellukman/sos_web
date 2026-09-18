// Perhitungan periode invoice dari kontrak. Semua tanggal berupa string "YYYY-MM-DD".

export type KontrakJadwal = {
  tanggal: string; // tanggal kontrak
  recurring: boolean;
  tanggalAwal: string; // RECURRING_INVOICE_TANGGAL_AWAL
  periode: string | null; // BULAN | TAHUN
  periodeValue: number | null;
  selesai: boolean;
  selesaiTanggal: string;
};

/** Periode invoice. awal/akhir null = invoice 1 kali (tanpa periode). */
export type Periode = { awal: string | null; akhir: string | null; jatuhTempo: string };

const MAX_PERIODE = 1200;

function parts(d: string) {
  const [y, m, day] = d.split("-").map(Number);
  return { y, m, day };
}

const pad = (n: number) => String(n).padStart(2, "0");
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Tambah bulan dari tanggal awal; tanggal disesuaikan ke akhir bulan bila perlu (31 Jan + 1 bln = 28/29 Feb). */
export function addMonths(date: string, months: number) {
  const { y, m, day } = parts(date);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${pad(nm)}-${pad(Math.min(day, daysInMonth(ny, nm)))}`;
}

export function addDays(date: string, days: number) {
  const { y, m, day } = parts(date);
  return new Date(Date.UTC(y, m - 1, day + days)).toISOString().slice(0, 10);
}

const stepBulan = (k: KontrakJadwal) => Math.max(1, k.periodeValue ?? 1) * (k.periode === "TAHUN" ? 12 : 1);

/**
 * Semua periode yang jatuh tempo sampai tanggal `sampai`.
 * - Invoice 1 kali: satu periode, jatuh tempo = tanggal kontrak.
 * - Berulang: mulai RECURRING_INVOICE_TANGGAL_AWAL, tiap N bulan/tahun. Periode dihitung selalu dari
 *   tanggal awal (bukan dari periode sebelumnya) agar tanggal tidak bergeser di akhir bulan.
 *   Jika kontrak selesai, periode yang dimulai pada/sesudah tanggal selesai tidak ditagih.
 */
export function hitungPeriode(k: KontrakJadwal, sampai: string): Periode[] {
  if (!k.recurring) {
    return k.tanggal && k.tanggal <= sampai ? [{ awal: null, akhir: null, jatuhTempo: k.tanggal }] : [];
  }
  if (!k.tanggalAwal) return [];

  const step = stepBulan(k);
  const hasil: Periode[] = [];
  for (let i = 0; i < MAX_PERIODE; i++) {
    const awal = addMonths(k.tanggalAwal, i * step);
    if (awal > sampai) break;
    if (k.selesai && k.selesaiTanggal && awal >= k.selesaiTanggal) break;
    const akhir = addDays(addMonths(k.tanggalAwal, (i + 1) * step), -1);
    hasil.push({ awal, akhir, jatuhTempo: awal });
  }
  return hasil;
}

/** Apakah `awal` adalah awal periode yang sah untuk kontrak ini. */
export function cariPeriode(k: KontrakJadwal, awal: string | null): Periode | null {
  if (!k.recurring) return awal === null && k.tanggal ? { awal: null, akhir: null, jatuhTempo: k.tanggal } : null;
  if (!awal) return null;
  return hitungPeriode(k, awal).find((p) => p.awal === awal) ?? null;
}

/** PPN dibulatkan ke rupiah terdekat, .5 ke atas (commercial rounding). */
export function hitungTotal(nilaiSebelumPpn: number, pctPpn: number) {
  const ppnMentah = (nilaiSebelumPpn * pctPpn) / 100;
  const nilaiPpn = Math.sign(ppnMentah) * Math.round(Math.abs(ppnMentah) + 1e-9);
  const nilaiAkhir = Math.round((nilaiSebelumPpn + nilaiPpn) * 100) / 100;
  return { nilaiPpn, nilaiAkhir };
}

/** Qty x harga dalam 2 desimal tanpa galat pembulatan float. */
export const kaliHarga = (qty: number, harga: number) => Math.round(qty * Math.round(harga * 100)) / 100;
