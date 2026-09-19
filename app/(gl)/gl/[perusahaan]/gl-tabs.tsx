"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const groups = [
  {
    label: "Transaction",
    tabs: [
      { sub: "/jurnal", label: "Jurnal" },
      { sub: "/copy-jurnal", label: "Copy Jurnal" },
      { sub: "/jurnal-foto", label: "Jurnal dari Foto" },
      { sub: "/jurnal-kamera", label: "Jurnal dari Kamera" },
    ],
  },
  {
    label: "Report",
    tabs: [
      { sub: "/neraca-saldo", label: "Neraca Saldo" },
      { sub: "/buku-besar", label: "Buku Besar" },
      { sub: "/rugi-laba", label: "Rugi Laba" },
      { sub: "/neraca", label: "Neraca" },
    ],
  },
  {
    label: "Utility",
    tabs: [{ sub: "/setup-periode", label: "Setup Periode" }],
  },
];

const btnCls = (active: boolean) =>
  `rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition ${
    active ? "bg-accent/10 font-medium text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
  }`;

export default function GlTabs({ perusahaan }: { perusahaan: string }) {
  const pathname = usePathname();
  const base = `/gl/${encodeURIComponent(perusahaan)}`;
  const isActive = (sub: string) => pathname === `${base}${sub}` || pathname.startsWith(`${base}${sub}/`);
  const groupAktif = groups.find((g) => g.tabs.some((t) => isActive(t.sub)))?.label ?? null;

  // Hanya satu grup terbuka; awalnya grup halaman yang sedang dibuka. Pilihan user berlaku sampai pindah halaman.
  const [pilih, setPilih] = useState<{ path: string; label: string | null } | null>(null);
  const open = pilih?.path === pathname ? pilih.label : groupAktif;
  const grupTerbuka = groups.find((g) => g.label === open);

  return (
    <nav className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {groups.map((g) => {
          const terbuka = g.label === open;
          return (
            <button
              key={g.label}
              type="button"
              onClick={() => setPilih({ path: pathname, label: terbuka ? null : g.label })}
              aria-expanded={terbuka}
              className={`${btnCls(terbuka || (g.label === groupAktif && !open))} inline-flex items-center gap-1.5`}
            >
              {g.label}
              <span aria-hidden className={`text-xs text-muted transition-transform ${terbuka ? "rotate-90" : ""}`}>
                ▸
              </span>
            </button>
          );
        })}
      </div>

      {grupTerbuka && (
        <div className="flex flex-wrap gap-1 rounded-lg bg-surface-2/50 p-1">
          {grupTerbuka.tabs.map((t) => (
            <Link key={t.sub} href={`${base}${t.sub}`} aria-current={isActive(t.sub) ? "page" : undefined} className={btnCls(isActive(t.sub))}>
              {t.label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
