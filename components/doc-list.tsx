import { formatBytes, isViewable } from "@/lib/documents";

export type DocItem = { sub: number; ext: string; filesize: number };

export const docUrl = (noRef: number, item: number, sub: number, download = false) =>
  `/api/kontrak-doc/${noRef}/${item}/${sub}${download ? "?download=1" : ""}`;

export default function DocList({ noRef, item, docs }: { noRef: number; item: number; docs: DocItem[] }) {
  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {docs.map((d) => (
        <li key={d.sub} className="flex items-center gap-3 px-3 py-2 text-sm">
          <span className="flex h-8 w-11 shrink-0 items-center justify-center rounded-md bg-surface-2 text-[10px] font-semibold text-ink-2 uppercase">
            {d.ext || "?"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate">Dokumen {d.sub}</span>
            <span className="text-xs text-muted">{formatBytes(d.filesize)}</span>
          </span>
          {isViewable(d.ext) && (
            <a
              href={docUrl(noRef, item, d.sub)}
              target="_blank"
              rel="noopener"
              className="rounded-md px-2 py-1 text-xs text-accent-ink hover:bg-surface-2"
            >
              Lihat
            </a>
          )}
          <a href={docUrl(noRef, item, d.sub, true)} className="rounded-md px-2 py-1 text-xs text-accent-ink hover:bg-surface-2">
            Unduh
          </a>
        </li>
      ))}
    </ul>
  );
}
