import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "./login-form";

export const metadata: Metadata = { title: "Login" };

const words = ["Star", "Office", "Solutions"];

export default async function LoginPage() {
  if (await getSession()) redirect("/");

  return (
    <main className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      {/* Panel brand */}
      <section className="login-hero relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col">
        <div className="login-grid absolute inset-0" aria-hidden />
        <div className="login-blob absolute -top-32 -left-24 size-[28rem] rounded-full bg-sky-400/30" aria-hidden />
        <div
          className="login-blob absolute -right-32 -bottom-40 size-[32rem] rounded-full bg-indigo-500/30 [animation-delay:-6s]"
          aria-hidden
        />

        <div className="relative flex items-center gap-2 text-sm font-medium tracking-wide text-white/80">
          <span className="size-2 rounded-full bg-sky-300 shadow-[0_0_12px_var(--color-sky-300)]" />
          PT. SOS
        </div>

        <div className="relative my-auto">
          <div className="fade-up mb-8 inline-flex size-28 items-center justify-center rounded-3xl bg-white/95 shadow-2xl shadow-black/20 ring-1 ring-white/40">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG vektor, tidak perlu optimasi next/image */}
            <img src="/logo-sos.svg" alt="Logo SOS" width={88} height={88} className="size-22" />
          </div>
          <h2 className="text-6xl leading-[1.05] font-semibold tracking-tight xl:text-7xl">
            {words.map((w, i) => (
              <span key={w} className="fade-up block" style={{ animationDelay: `${i * 120}ms` }}>
                <span className="bg-gradient-to-b from-white to-sky-200 bg-clip-text text-transparent">{w[0]}</span>
                <span className="text-white/55">{w.slice(1)}</span>
              </span>
            ))}
          </h2>
          <div className="fade-up mt-8 h-1 w-16 rounded-full bg-sky-300/80 [animation-delay:400ms]" aria-hidden />
        </div>

        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} PT. SOS</p>
      </section>

      {/* Form */}
      <section className="relative flex items-center justify-center overflow-hidden px-4 py-12 sm:px-8">
        <div className="login-glow absolute inset-x-0 top-0 h-72 lg:hidden" aria-hidden />
        <div className="fade-up relative w-full max-w-sm">
          <div className="mb-8">
            <div className="mb-4 flex items-center gap-3 lg:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element -- SVG vektor */}
              <img src="/logo-sos.svg" alt="Logo SOS" width={48} height={48} className="size-12" />
              <p className="text-sm font-medium text-accent-ink">Star Office Solutions</p>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">SOS Login</h1>
            <p className="mt-2 text-sm text-ink-2">Selamat datang kembali. Masuk dengan user ID aplikasi Anda.</p>
          </div>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
