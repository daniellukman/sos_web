import { td } from "@/components/ui";

/** Sel nama akun dengan indentasi sesuai level hierarki. */
export function NamaAkun({ nama, level }: { nama: string; level: number }) {
  return (
    <td className={td} style={{ paddingLeft: `${1 + (level - 1) * 1.25}rem` }}>
      {nama}
    </td>
  );
}

export const rowCls = (induk: boolean) => `hover:bg-surface-2/60 ${induk ? "bg-surface-2/40 font-medium" : ""}`;
export const angka = `${td} tabular text-right whitespace-nowrap`;
