import type { AkunOption } from "@/lib/gl";

type Props = { name: string; value: string; label: string; akunList: AkunOption[]; className?: string; required?: boolean };

/** Dropdown akun transaksi (dipakai form baca foto dan tabel draft). */
export default function AkunSelect({ name, value, label, akunList, className = "input", required }: Props) {
  return (
    <select name={name} defaultValue={value} className={className} aria-label={label} required={required}>
      <option value="">— {label} —</option>
      {akunList.map((a) => (
        <option key={a.akun} value={a.akun}>
          {a.akun} · {a.nama}
        </option>
      ))}
    </select>
  );
}
