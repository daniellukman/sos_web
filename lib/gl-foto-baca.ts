import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

// Membaca tanggal & nilai yang dibayar dari foto bon/bill/invoice dengan model vision Claude.

export const MODEL_BACA_FOTO = "claude-sonnet-5";
/** Batas ukuran gambar yang dikirim ke API */
export const BACA_MAX_BYTES = 5 * 1024 * 1024;
const PARALEL = 4;

const HasilFoto = z.object({
  tanggal: z.string().nullable().describe("Tanggal transaksi pada bon dalam format YYYY-MM-DD, null jika tidak terbaca"),
  nilai: z.number().nullable().describe("Total yang dibayar dalam rupiah (angka saja, tanpa pemisah ribuan), null jika tidak terbaca"),
  merchant: z.string().nullable().describe("Nama toko/merchant/penerbit bon, null jika tidak terbaca"),
  keterangan: z.string().describe("Ringkasan singkat isi pembelian, maksimal 60 karakter"),
  yakin: z.boolean().describe("true jika tanggal dan nilai terbaca jelas"),
});

export type HasilBacaFoto = z.infer<typeof HasilFoto>;

const SYSTEM = `Kamu membaca foto bon, struk, bill, atau invoice dari Indonesia untuk dijurnal sebagai biaya perusahaan.
Ambil:
- tanggal transaksi (bukan tanggal cetak/jatuh tempo bila keduanya ada). Format tanggal Indonesia umumnya hari/bulan/tahun (03/06/2026 = 3 Juni 2026). Tahun 2 digit berarti 20xx.
- nilai yang benar-benar dibayar: baris "Total", "Total Amount", "Grand Total", "Payment", "Jumlah", atau "Dibayar" setelah pajak/service/diskon. Bukan subtotal, bukan uang yang diserahkan, bukan kembalian. Angka rupiah: "152,000.00" dan "152.000" sama-sama berarti 152000.
- nama merchant dan ringkasan barang/jasa yang dibeli.
Jika ragu atau tidak terbaca, isi null dan yakin=false. Jangan mengarang.`;

export type FotoInput = { ext: string; bytes: Buffer };

const mediaType = (ext: string): "image/jpeg" | "image/png" | null =>
  ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "png" ? "image/png" : null;

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) throw new BacaFotoError("ANTHROPIC_API_KEY belum diisi di .env.local.");
  // Batasi waktu tunggu agar tombol "Membaca…" tidak menggantung (default SDK 10 menit + 2 retry)
  client ??= new Anthropic({ timeout: 60_000, maxRetries: 1 });
  return client;
}

/** Kesalahan yang aman ditampilkan ke user. */
export class BacaFotoError extends Error {}

export async function bacaFoto(foto: FotoInput): Promise<HasilBacaFoto> {
  const media = mediaType(foto.ext);
  if (!media) throw new BacaFotoError(`Tipe .${foto.ext} tidak didukung untuk dibaca (pakai jpg/png).`);
  if (foto.bytes.length > BACA_MAX_BYTES) throw new BacaFotoError("Ukuran foto melebihi 5 MB.");

  const response = await getClient().messages.parse({
    model: MODEL_BACA_FOTO,
    max_tokens: 1024,
    system: SYSTEM,
    // Ekstraksi sederhana: effort rendah sudah cukup dan lebih murah
    output_config: { effort: "low", format: zodOutputFormat(HasilFoto) },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: media, data: foto.bytes.toString("base64") } },
          { type: "text", text: "Baca tanggal transaksi dan total yang dibayar dari bon ini." },
        ],
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new BacaFotoError("Model menolak membaca foto ini.");
  if (!response.parsed_output) throw new BacaFotoError("Jawaban model tidak bisa diurai.");
  return response.parsed_output;
}

/** Baca banyak foto dengan beberapa permintaan paralel; kegagalan per foto dikembalikan sebagai pesan, bukan dilempar. */
export async function bacaBanyakFoto(fotos: FotoInput[]): Promise<({ ok: true; hasil: HasilBacaFoto } | { ok: false; pesan: string })[]> {
  const out: ({ ok: true; hasil: HasilBacaFoto } | { ok: false; pesan: string })[] = new Array(fotos.length);
  let next = 0;
  const worker = async () => {
    while (next < fotos.length) {
      const i = next++;
      try {
        out[i] = { ok: true, hasil: await bacaFoto(fotos[i]) };
      } catch (err) {
        out[i] = { ok: false, pesan: pesanError(err) };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALEL, fotos.length) }, worker));
  return out;
}

function pesanError(err: unknown): string {
  if (err instanceof BacaFotoError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return "API key Anthropic tidak valid.";
  if (err instanceof Anthropic.RateLimitError) return "Terlalu banyak permintaan ke API, coba lagi sebentar.";
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "Membaca foto terlalu lama (lebih dari 60 detik), coba lagi.";
  if (err instanceof Anthropic.APIConnectionError) return "Tidak bisa terhubung ke API Anthropic.";
  if (err instanceof Anthropic.APIError) return `API error ${err.status}: ${err.message}`;
  console.error("Baca foto gagal:", err);
  return "Gagal membaca foto.";
}
