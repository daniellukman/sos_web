import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mssql"],
  // Sembunyikan tombol "N" Next.js di pojok kiri bawah saat npm run dev
  devIndicators: false,
  // npm run dev dibuka dari HP lewat IP jaringan lokal PC (mis. http://192.168.55.220:3000).
  // Tanpa ini Next.js memblokir script dev dari origin lain, sehingga tombol (mis. menu GL) tidak berfungsi di HP.
  allowedDevOrigins: ["192.168.55.*"],
  experimental: {
    // Upload dokumen progress kontrak: maks. 25 MB file per simpan (lib/documents.ts) + sisa form
    serverActions: { bodySizeLimit: "30mb" },
    // Proxy ikut membaca body request; samakan batasnya agar upload tidak terpotong
    proxyClientMaxBodySize: "30mb",
  },
};

export default nextConfig;
