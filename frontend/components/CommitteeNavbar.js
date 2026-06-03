"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/committee", label: "總覽" },
  { href: "/committee/accounts", label: "帳號管理" },
  { href: "/committee/vendors", label: "商家管理" },
  { href: "/committee/registrations", label: "入駐審核" },
  { href: "/committee/appeals", label: "申訴處理" },
  { href: "/committee/billing", label: "帳單管理" },
];

export default function CommitteeNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setUser(data))
      .catch(() => {});
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const displayName = user?.full_name || user?.email?.split("@")[0] || "管理員";
  const avatarChar = displayName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--admin-coffee-700)]/30 bg-[var(--admin-coffee-900)] text-white shadow-sm">
      <div className="flex min-h-16 w-full flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/committee" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-xs font-black tracking-tight text-[var(--admin-coffee-700)]">
              TSMC
            </span>
            <span>
              <span className="block text-base font-bold leading-tight">企業訂餐平台</span>
              <span className="block text-xs font-medium text-[var(--admin-coffee-100)]">福委會 · Admin</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center justify-between gap-3">
          <nav className="flex flex-wrap items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/committee"
                  ? pathname === "/committee"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-[var(--admin-coffee-400)] text-white"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}

            {/* 員工視角入口：admin 也是員工，需要點餐 */}
            {/* <Link
              href="/employee"
              className="ml-2 rounded-md border border-[var(--admin-coffee-400)] px-3 py-2 text-sm font-semibold text-[var(--admin-coffee-100)] transition hover:bg-[var(--admin-coffee-400)] hover:text-white"
              title="切換到員工點餐畫面（我也是員工，要訂便當）"
            >
              員工點餐 →
            </Link> */}
          </nav>

          <div className="flex items-center gap-2 border-l border-white/20 pl-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold leading-tight">{displayName}</p>
              <p className="text-xs text-[var(--admin-coffee-100)]">福委會</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--admin-coffee-400)] font-black text-white">
              {avatarChar}
            </div>
            <button
              onClick={logout}
              className="rounded-md border border-white/30 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              登出
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}