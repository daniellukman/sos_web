"use client";

export default function PrintButton() {
  return (
    <>
      <button type="button" onClick={() => window.close()} className="rounded-lg bg-white px-4 py-2 text-sm text-neutral-700 shadow hover:bg-neutral-50">
        Tutup
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg bg-[#2a78d6] px-4 py-2 text-sm font-medium text-white shadow hover:brightness-110"
      >
        🖨 Cetak / Simpan PDF
      </button>
    </>
  );
}
