"use client";

import type { ReactNode } from "react";

/** Tombol submit yang minta konfirmasi dulu; dipakai di dalam <form action={...}>. */
export default function ConfirmButton({ message, className, children }: { message: string; className?: string; children: ReactNode }) {
  return (
    <button
      className={className}
      onClick={(ev) => {
        if (!confirm(message)) ev.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
