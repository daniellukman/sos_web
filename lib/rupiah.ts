// Parsing/format angka rupiah gaya Indonesia, dipakai di server dan browser (tanpa import server-only)

/** "1.500.000" / "1.500.000,50" / "1500000" -> angka. NaN jika kosong/tidak valid. */
export function parseRupiah(raw: string): number {
  let s = raw.replace(/[^\d.,-]/g, "");
  s = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/\./g, "");
  return s === "" ? NaN : Number(s);
}

const fmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 });

/** Angka -> "1.500.000" (tanpa "Rp"); string kosong untuk 0/NaN. */
export const formatAngka = (n: number) => (Number.isFinite(n) && n !== 0 ? fmt.format(n) : "");
