# SOS Dashboard

Aplikasi web Next.js untuk PT. SOS yang terhubung ke database Azure SQL `sos_db`.

## Menjalankan

1. Salin `.env.example` menjadi `.env.local`, lalu isi koneksi Azure SQL dan `SESSION_SECRET`.
2. `npm install`
3. `npm run dev` lalu buka http://localhost:3000

Produksi: `npm run build` lalu `npm start`.

## Login

Memakai tabel `USERTBL` (kolom `USERID` dan `PWD` berisi hash bcrypt).
Hanya user yang terdaftar untuk perusahaan `SOS` di `USER_PERUSAHAAN` yang bisa masuk.

## Menu dan tabel

| Menu     | Tabel                                                                 | Akses        |
| -------- | --------------------------------------------------------------------- | ------------ |
| Customer | `Customer` (+ `JUAL_HDR` untuk total penjualan)                       | Baca & tulis |
| Kontrak  | `CUSTOMER_KONTRAK`, `CUSTOMER_KONTRAK_UPDATE`, `CUSTOMER_KONTRAK_DOC` | Baca & tulis |

No. Ref kontrak diambil dari procedure `GET_NO_REF`.

## Menu GL (semua perusahaan user)

Sub-menu GL muncul per perusahaan yang terdaftar untuk user di `USER_PERUSAHAAN` (URL `/gl/<KODE>/...`).
User yang tidak punya akses SOS tetap bisa login untuk GL.

| Halaman      | Sumber data                                                  | Akses        |
| ------------ | ------------------------------------------------------------ | ------------ |
| Neraca Saldo | `GLBalnc` (hasil posting), detail buku besar dari `TRNDTL`    | Baca         |
| Jurnal       | `TRNHDR`, `TRNDTL`, foto di `DOC`, nomor dari `COUNTER_BLN`   | Baca & tulis |
| Rugi Laba    | `GLBalnc`, batas akun dari `SETUP_TBL` (`AWAL_RL`), akun penampung dari `GLSETUP.RLSementara` | Baca |
| Neraca       | `GLBalnc`, batas akun `AWAL_AKTIVA` / `AWAL_PASSIVA` / `AWAL_RL` | Baca      |
| Copy Jurnal  | Salin `TRNHDR`, `TRNDTL`, `DOC` dari perusahaan lain milik user | Tulis       |
| Jurnal dari Foto | Baca tanggal & nilai dari foto bon dengan Claude (`claude-sonnet-5`), draft di memori server, lalu tulis `TRNHDR`, `TRNDTL`, `DOC` | Tulis |

- Jurnal hanya bisa diinput/diubah/dihapus jika bulan tanggalnya `ACTIVE = 1` di `SETUPBULAN` perusahaan tsb.
- Hanya jurnal jenis `BMM` yang bisa diubah; jurnal tutup bulan (`EOM`) hanya bisa dilihat.
- Akun jurnal harus `GLAcc.TL = '0'` milik perusahaan yang sama. Cost center dari `COST_CENTER`.
- Jurnal dari Foto butuh `ANTHROPIC_API_KEY` di `.env.local` (console.anthropic.com → API Keys). Akun default dari `SETUP_TBL`
  `IMPORT_DEBET` / `IMPORT_CREDIT`. Draft hasil baca disimpan di memori server (hilang saat restart / setelah 4 jam).
- **`GLBalnc` dan `GLBalnc_DTL` tidak pernah ditulis dari web** — posting dilakukan program lain, jadi jurnal baru
  tampil di Neraca Saldo / Rugi Laba / Neraca setelah proses posting.
