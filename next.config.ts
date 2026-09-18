import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mssql"],
  // Sembunyikan tombol "N" Next.js di pojok kiri bawah saat npm run dev
  devIndicators: false,
  experimental: {
    // Upload dokumen progress kontrak: maks. 25 MB file per simpan (lib/documents.ts) + sisa form
    serverActions: { bodySizeLimit: "30mb" },
    // Proxy ikut membaca body request; samakan batasnya agar upload tidak terpotong
    proxyClientMaxBodySize: "30mb",
  },
};

export default nextConfig;
