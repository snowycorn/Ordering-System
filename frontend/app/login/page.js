// app/login/page.js
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ROLE_DESTINATIONS = {
  admin: "/committee",
  vendor: "/vendor",
  employee: "/employee",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.message || "登入失敗，請再試一次");
        return;
      }

      // 依後端回傳的 role 決定要跳到哪裡
      const destination = ROLE_DESTINATIONS[data.role] || "/employee";
      router.push(destination);
      router.refresh();
    } catch {
      setError("無法連線，請稍後再試");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="portal-shell grid min-h-screen px-4 py-8 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-10">
      <section className="motion-fade-up hidden items-center text-white lg:flex">
        <div className="max-w-lg">
          <Link
            href="/"
            className="inline-flex items-center gap-3 rounded-md border border-white/20 bg-white/10 px-3 py-2 backdrop-blur"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded bg-white text-xs font-black text-[var(--navy-800)]">
              TSMC
            </span>
            <span className="text-sm font-semibold text-white/80">企業訂餐平台</span>
          </Link>
          <p className="mt-8 text-sm font-bold uppercase tracking-[0.2em] text-[var(--teal-200)]">
            Login
          </p>
          <h1 className="mt-3 text-5xl font-black leading-tight">歡迎使用<br />企業訂餐平台</h1>
          <p className="mt-5 text-base leading-7 text-[var(--navy-50)]">
            登入後系統會依您的身分（員工 / 商家 / 福委會）自動帶您進入對應的工作畫面。
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center">
        <div className="motion-fade-up-delay glass-panel w-full max-w-md rounded-lg p-5 sm:p-6">
          <div className="mb-6 lg:hidden">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--navy-800)] text-xs font-black text-white">
                TSMC
              </span>
              <span>
                <span className="block font-black text-[var(--navy-900)]">企業訂餐平台</span>
                <span className="block text-xs font-semibold text-[var(--teal-600)]">登入</span>
              </span>
            </Link>
          </div>

          <div className="mb-6">
            <p className="text-sm font-bold text-[var(--teal-600)]">Login</p>
            <h2 className="mt-2 text-3xl font-black text-[var(--navy-900)]">歡迎回來</h2>
            <p className="mt-2 text-sm text-slate-500">
              請輸入您的帳號密碼，系統會依身分帶您前往對應畫面。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm font-medium text-[var(--error-fg)]">
                {error}
              </div>
            )}

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--teal-400)] focus:ring-2 focus:ring-[var(--teal-200)]/50"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">密碼</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="請輸入密碼"
                required
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--teal-400)] focus:ring-2 focus:ring-[var(--teal-200)]/50"
              />
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-[var(--navy-600)] py-2.5 text-sm font-bold text-white transition hover:bg-[var(--navy-800)] disabled:opacity-60"
            >
              {loading ? "登入中..." : "登入"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">
            外部商家想加入？{" "}
            <Link href="/register" className="font-bold text-[var(--navy-600)] hover:underline">
              申請入駐
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}