// components/Navbar.js
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const navSets = {
  employee: [
    { href: "/employee", label: "菜單總覽" },
    { href: "/orders", label: "歷史訂單" },
    { href: "/notifications", label: "通知" },
    { href: "/appeal", label: "申訴" },
  ],
  vendor: [{ href: "/vendor", label: "商家工作台" }],
  committee: [{ href: "/committee", label: "福委會工作台" }],
};

function currentPortal(pathname) {
  if (pathname.startsWith("/vendor")) return "vendor";
  if (pathname.startsWith("/committee")) return "committee";
  return "employee";
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const portal = currentPortal(pathname);
  const navItems = navSets[portal];
  const [user, setUser] = useState(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    // 撈使用者資料
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setUser(data))
      .catch(() => {});

    // 撈未讀通知數
    const fetchUnread = () => {
      fetch("/api/notifications/unread")
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => data && setUnread(data.unread))
        .catch(() => {});
    };
    fetchUnread();
    const timer = setInterval(fetchUnread, 30000);
    window.addEventListener("notifications:updated", fetchUnread);
    return () => {
      clearInterval(timer);
      window.removeEventListener("notifications:updated", fetchUnread);
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  const displayName = user?.full_name || user?.email?.split("@")[0] || "使用者";
  const avatarChar = displayName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--navy-800)]/20 bg-[var(--navy-900)] text-white shadow-sm">
      <div className="flex min-h-16 w-full flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-xs font-black tracking-tight text-[var(--navy-800)]">TSMC</span>
            <span>
              <span className="block text-base font-bold leading-tight">企業訂餐平台</span>
              <span className="block text-xs font-medium text-[var(--teal-200)]">
                {portal === "vendor" ? "商家端" : portal === "committee" ? "福委會端" : "員工 · Employee"}
              </span>
            </span>
          </Link>
        </div>

        <div className="flex items-center justify-between gap-3">
          <nav className="flex flex-wrap items-center gap-1">
            {navItems.map((item) => {
              const active =
                item.href === "/employee"
                  ? pathname === "/employee" || pathname.startsWith("/employee/")
                  : pathname.startsWith(item.href);
              const isNotif = item.href === "/notifications";

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative rounded-md px-3 py-2 text-sm font-semibold transition ${
                    active ? "bg-[var(--teal-400)] text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                  {/* 通知按鈕右上紅點 */}
                  {isNotif && unread > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--error-fg)] px-1 text-[10px] font-bold text-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </Link>
              );
            })}
            {user?.role === "admin" && (
              <Link
                href="/committee"
                className="ml-2 rounded-md border border-[var(--admin-coffee-400)] px-3 py-2 text-sm font-semibold text-[var(--admin-coffee-100)] transition hover:bg-[var(--admin-coffee-400)] hover:text-white"
                title="回到福委會管理畫面"
              >
                福委會端 →
              </Link>
          )}



          </nav>

          {/* 使用者資訊 + 頭像 */}
          <div className="flex items-center gap-2 border-l border-white/20 pl-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold leading-tight">{displayName}</p>
              <p className="text-xs text-[var(--teal-200)]">{user?.role || "—"}</p>
            </div>
            <Link
              href="/profile"
              title="個人資料"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--teal-400)] font-black text-white transition hover:scale-110"
            >
              {avatarChar}
            </Link>
            <button onClick={logout} className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10">
              登出
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}