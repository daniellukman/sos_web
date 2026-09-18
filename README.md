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
