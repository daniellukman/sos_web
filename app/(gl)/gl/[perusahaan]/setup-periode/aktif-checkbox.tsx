"use client";

import { useOptimistic, useTransition } from "react";
import { ubahAktifAction } from "./actions";

type Props = { perusahaan: string; tahun: number; bulan: number; label: string; active: boolean };

/** Centang = periode aktif. Langsung disimpan saat diklik. */
export default function AktifCheckbox({ perusahaan, tahun, bulan, label, active }: Props) {
  const [pending, startTransition] = useTransition();
  const [checked, setChecked] = useOptimistic(active);

  return (
    <input
      type="checkbox"
      checked={checked}
      disabled={pending}
      onChange={(ev) => {
        const next = ev.target.checked;
        startTransition(async () => {
          setChecked(next);
          await ubahAktifAction(perusahaan, tahun, bulan, next);
        });
      }}
      aria-label={`${label} aktif`}
      className="size-4 cursor-pointer accent-(--accent) disabled:cursor-wait"
    />
  );
}
