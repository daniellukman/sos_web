"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Company } from "@/lib/company";

const sosLinks = [
  { href: "/customer", label: "Customer" },
  { href: "/kontrak", label: "Kontrak" },
  { href: "/invoice", label: "Outstanding Invoice" },
  { href: "/faktur", label: "Daftar Invoice" },
];

const linkCls = (active: boolean) =>
  `rounded-lg px-3 py-2 text-sm whitespace-nowrap transition ${
    active ? "bg-accent/10 font-medium text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
  }`;

export default function Nav({ hasSos, companies }: { hasSos: boolean; companies: Company[] }) {
  const pathname = usePathname();
  const onGl = pathname === "/gl" || pathname.startsWith("/gl/");

  // Grup GL terbuka otomatis saat berada di halaman GL; klik user menimpanya sampai pindah halaman
  const [manual, setManual] = useState<{ path: string; open: boolean } | null>(null);
  const open = manual?.path === pathname ? manual.open : onGl;

  return (
    // Di HP menu dibungkus ke beberapa baris (bukan geser horizontal) agar GL dan daftar perusahaannya terlihat
    <nav className="flex flex-wrap gap-1 px-3 pb-3 md:flex-col md:flex-nowrap md:overflow-y-auto md:px-3 md:pb-0">
      {hasSos &&
        sosLinks.map((link) => (
          <Link key={link.href} href={link.href} aria-current={pathname.startsWith(link.href) ? "page" : undefined} className={linkCls(pathname.startsWith(link.href))}>
            {link.label}
          </Link>
        ))}

      {companies.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setManual({ path: pathname, open: !open })}
            aria-expanded={open}
            className={`${linkCls(onGl && !open)} flex items-center justify-between gap-2 text-left`}
          >
            <span>GL</span>
            <span aria-hidden className={`text-xs text-muted transition-transform ${open ? "rotate-90" : ""}`}>
              ▸
            </span>
          </button>
          {open && (
            <div className="flex w-full flex-wrap gap-1 rounded-lg bg-surface-2/50 p-1 md:flex-col md:flex-nowrap md:bg-transparent md:p-0">
              {companies.map((c) => {
                const href = `/gl/${encodeURIComponent(c.kode)}`;
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link key={c.kode} href={href} aria-current={active ? "page" : undefined} className={`${linkCls(active)} md:ml-4`} title={c.nama}>
                    {c.kode}
                    <span className="ml-1.5 hidden text-xs font-normal text-muted md:inline">{c.nama}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </nav>
  );
}
