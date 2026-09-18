import { formatTanggal } from "@/lib/format";

/** Deskripsi default baris invoice. Invoice berulang menyertakan periode tagihan. */
export function deskripsiDefault(k: { lobNama: string | null; deskripsi: string }, p: { awal: string | null; akhir: string | null }) {
  const nama = k.lobNama || k.deskripsi || "Invoice kontrak";
  if (p.awal && p.akhir) return `${nama} periode ${formatTanggal(p.awal)} s/d ${formatTanggal(p.akhir)}`;
  return k.deskripsi ? `${nama} - ${k.deskripsi}`.slice(0, 2000) : nama;
}

export function labelPeriode(p: { awal: string | null; akhir: string | null }) {
  return p.awal && p.akhir ? `${formatTanggal(p.awal)} – ${formatTanggal(p.akhir)}` : "Invoice 1 kali";
}

export function labelJadwal(k: { recurring: boolean; periode: string | null; periodeValue: number | null }) {
  if (!k.recurring) return "1 kali";
  const n = k.periodeValue ?? 1;
  const unit = k.periode === "TAHUN" ? "tahun" : "bulan";
  return n === 1 ? `Tiap ${unit}` : `Tiap ${n} ${unit}`;
}
