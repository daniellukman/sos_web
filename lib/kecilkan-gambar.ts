// Kompres foto bon di browser sebelum dikirim (dipakai Jurnal dari Foto & Jurnal dari Kamera).
// Batas maksimum 200 KB (sampel bon yang ada 20–95 KB sudah jelas terbaca). Resolusi dibatasi per jumlah piksel,
// bukan sisi terpanjang, agar bon panjang (tinggi & sempit) tidak jadi terlalu sempit dan teksnya kabur.

export const TARGET_BYTES = 200 * 1024;
const MAX_PIKSEL = 1_600_000; // ±1600×1000
const MIN_SISI_PENDEK = 700; // di bawah ini teks bon kecil mulai sulit dibaca
const KUALITAS_AWAL = 0.82;
const KUALITAS_MIN = 0.55;

const encode = (canvas: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((ok, gagal) => canvas.toBlob((b) => (b ? ok(b) : gagal(new Error("Gagal mengompres foto"))), "image/jpeg", q));

function gambar(bmp: ImageBitmap, skala: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * skala));
  c.height = Math.max(1, Math.round(bmp.height * skala));
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return c;
}

/**
 * Perkecil gambar ke JPEG ±TARGET_BYTES. File JPEG/PNG yang sudah ≤ target dibiarkan apa adanya
 * agar kualitasnya tidak turun. Orientasi EXIF ikut diterapkan.
 */
export async function kecilkanGambar(blob: Blob, nama: string): Promise<File> {
  const namaJpg = nama.replace(/\.[^.]+$/, "") + ".jpg";
  if (blob.size <= TARGET_BYTES && /^image\/(jpeg|png)$/.test(blob.type)) return new File([blob], nama, { type: blob.type });

  const bmp = await createImageBitmap(blob, { imageOrientation: "from-image" });
  try {
    let skala = Math.min(1, Math.sqrt(MAX_PIKSEL / (bmp.width * bmp.height)));
    const skalaMin = Math.min(1, MIN_SISI_PENDEK / Math.min(bmp.width, bmp.height));
    let hasil: Blob | null = null;
    // Turunkan kualitas dulu, baru resolusi; berhenti di batas bawah keduanya walau masih > target
    for (;;) {
      const canvas = gambar(bmp, skala);
      for (let q = KUALITAS_AWAL; q >= KUALITAS_MIN - 1e-9; q -= 0.09) {
        hasil = await encode(canvas, q);
        if (hasil.size <= TARGET_BYTES) return new File([hasil], namaJpg, { type: "image/jpeg" });
      }
      if (skala <= skalaMin) break;
      skala = Math.max(skalaMin, skala * 0.8);
    }
    return new File([hasil!], namaJpg, { type: "image/jpeg" });
  } finally {
    bmp.close();
  }
}
