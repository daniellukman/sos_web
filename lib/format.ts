const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const tanggal = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

// Kolom datetime di DB berisi jam WIB tanpa zona; driver membacanya sebagai UTC,
// jadi tampilkan dengan timeZone UTC agar jamnya sama persis dengan yang tersimpan.
const tanggalJam = new Intl.DateTimeFormat("id-ID", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

const tanggalPanjang = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export const formatTanggalPanjang = (d: Date | string | null | undefined) => (d ? tanggalPanjang.format(new Date(d)) : "-");
export const formatTanggalJam = (d: Date | string | null | undefined) => (d ? tanggalJam.format(new Date(d)) : "-");
export const formatRupiah = (n: number | null | undefined) => rupiah.format(Number(n ?? 0));
export const formatTanggal = (d: Date | string | null | undefined) => (d ? tanggal.format(new Date(d)) : "-");
