"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { formatBytes } from "@/lib/gl-foto";
import { kecilkanGambar } from "@/lib/kecilkan-gambar";

const namaFoto = (n: number) => `kamera-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}-${n}.jpg`;

// Kamera langsung (getUserMedia) hanya ada di HTTPS/localhost; di HP lewat http://IP-lokal pakai aplikasi kamera HP
const noop = () => () => {};
const bisaLiveKamera = () => typeof window !== "undefined" && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;

type Props = { files: File[]; onChange: (files: File[]) => void };

export default function KameraPicker({ files, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [sibuk, setSibuk] = useState(false);
  const [error, setError] = useState("");
  const liveDidukung = useSyncExternalStore(noop, bisaLiveKamera, () => false);

  // URL pratinjau dibuat ulang saat daftar foto berubah, dan dilepas agar tidak bocor memori
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const matikan = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLive(false);
  };
  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  const tambah = async (blobs: Blob[]) => {
    setSibuk(true);
    setError("");
    try {
      const baru = await Promise.all(blobs.map((b, i) => kecilkanGambar(b, namaFoto(files.length + i + 1))));
      onChange([...files, ...baru]);
    } catch {
      setError("Foto tidak bisa diproses. Coba ambil ulang.");
    } finally {
      setSibuk(false);
    }
  };

  const nyalakan = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 } }, audio: false });
      streamRef.current = stream;
      setLive(true);
      // Tunggu elemen video tampil dulu sebelum dipasang stream-nya
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setError("Kamera tidak bisa dibuka. Pastikan izin kamera diberikan di browser.");
    }
  };

  const jepret = async () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/jpeg", 0.92));
    if (blob) await tambah([blob]);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {/* capture="environment" membuka kamera belakang HP langsung (tetap jalan di http) */}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(ev) => {
            const f = Array.from(ev.target.files ?? []);
            ev.target.value = "";
            if (f.length) void tambah(f);
          }}
        />
        <button type="button" onClick={() => inputRef.current?.click()} className="btn" disabled={sibuk}>
          📷 Ambil foto
        </button>
        {liveDidukung &&
          (live ? (
            <button type="button" onClick={matikan} className="btn-ghost">
              Tutup kamera
            </button>
          ) : (
            <button type="button" onClick={nyalakan} className="btn-ghost">
              Kamera langsung
            </button>
          ))}
        {sibuk && <span className="self-center text-sm text-muted">Memproses foto…</span>}
      </div>

      {live && (
        <div className="space-y-2">
          <video ref={videoRef} playsInline muted className="max-h-[60vh] w-full rounded-lg border border-line bg-black object-contain" />
          <button type="button" onClick={jepret} className="btn w-full sm:w-auto" disabled={sibuk}>
            ● Jepret
          </button>
        </div>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {files.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- pratinjau lokal (blob URL) */}
              <img src={previews[i]} alt={`Foto ${i + 1}`} className="aspect-[3/4] w-full rounded-lg border border-line object-cover" />
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">{formatBytes(f.size)}</span>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 flex size-6 items-center justify-center rounded-full bg-danger text-xs text-white"
                aria-label={`Hapus foto ${i + 1}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Belum ada foto. Tekan &quot;Ambil foto&quot; untuk memotret bon; ulangi untuk bon berikutnya.</p>
      )}
    </div>
  );
}
