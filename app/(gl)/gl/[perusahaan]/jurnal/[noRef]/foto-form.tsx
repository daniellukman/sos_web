"use client";

import { useActionState } from "react";
import { FOTO_EXT } from "@/lib/gl-foto";
import { tambahFoto, type FotoFormState } from "../actions";

export default function FotoForm({ perusahaan, noRef }: { perusahaan: string; noRef: number }) {
  const [state, action, pending] = useActionState<FotoFormState, FormData>(tambahFoto.bind(null, perusahaan, noRef), {});
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <input type="file" name="fotos" multiple required accept={FOTO_EXT.map((x) => `.${x}`).join(",")} className="text-sm" aria-label="Pilih foto" />
      <button className="btn py-1.5" disabled={pending}>
        {pending ? "Mengupload…" : "⬆ Upload foto"}
      </button>
      {state.error && <p className="w-full text-xs text-danger">{state.error}</p>}
    </form>
  );
}
