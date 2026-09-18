"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/customer", label: "Customer" },
  { href: "/kontrak", label: "Kontrak" },
  { href: "/invoice", label: "Outstanding Invoice" },
  { href: "/faktur", label: "Daftar Invoice" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:px-3 md:pb-0">
      {links.map((link) => {
        const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-lg px-3 py-2 text-sm whitespace-nowrap transition ${
              active ? "bg-accent/10 font-medium text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
