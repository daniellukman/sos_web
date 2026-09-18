import type { StatusBayar } from "@/lib/faktur";

export default function StatusBayarBadge({ status }: { status: StatusBayar }) {
  if (status === "lunas")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-good-bg px-2 py-0.5 text-xs font-medium whitespace-nowrap text-good">
        <span aria-hidden>✓</span> Lunas
      </span>
    );
  if (status === "sebagian")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warn-bg px-2 py-0.5 text-xs font-medium whitespace-nowrap text-warn-ink">
        <span aria-hidden>◐</span> Dibayar sebagian
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-ink-2">
      <span aria-hidden>○</span> Belum dibayar
    </span>
  );
}
