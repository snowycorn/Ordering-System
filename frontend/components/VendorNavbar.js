"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const NAV_ITEMS = [
  { href: "/vendor", label: "商家工作台" },
  { href: "/vendor/menus", label: "菜單總覽" },
  { href: "/vendor/orders", label: "訂單總覽" },
  { href: "/vendor/notifications", label: "通知" },
  { href: "/vendor/billing", label: "當月收益" },
];

export default function VendorNavbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [vendor, setVendor] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  function refreshUnread() {
    fetch("/api/notifications/unread")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setUnreadCount(data.unread ?? 0))
      .catch(() => {});
  }

  // 初次 mount：抓商家資料 + 未讀數
  useEffect(() => {
    fetch("/api/vendor/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setVendor(data))
      .catch(() => {});
    refreshUnread();
  }, []);

  // pathname 變化時重抓（例如看完通知詳情返回列表）
  useEffect(() => {
    refreshUnread();
  }, [pathname]);

  // 監聽「全部已讀 / 單筆已讀」事件，立即更新
  useEffect(() => {
    window.addEventListener("notifications:updated", refreshUnread);
    return () => window.removeEventListener("notifications:updated", refreshUnread);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const displayName = vendor?.name || "商家";
  const avatarChar = displayName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--vendor-gray-700)]/30 bg-[var(--vendor-gray-900)] text-white shadow-sm">
      <div className="flex min-h-16 w-full flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/vendor" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-xs font-black tracking-tight text-[var(--vendor-gray-700)]">TSMC</span>
            <span>
              <span className="block text-base font-bold leading-tight">企業訂餐平台</span>
              <span className="block text-xs font-medium text-[var(--vendor-gray-100)]">商家 · Vendor</span>
            </span>
          </Link>
        </div>

        <div className="flex items-center justify-between gap-3">
          <nav className="flex flex-wrap items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/vendor"
                  ? pathname === "/vendor"
                  : pathname.startsWith(item.href);
              const isNotifications = item.href === "/vendor/notifications";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative rounded-md px-3 py-2 text-sm font-semibold transition ${
                    active
                      ? "bg-[var(--vendor-gray-400)] text-white"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {item.label}
                  {isNotifications && unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 border-l border-white/20 pl-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-bold leading-tight">
                {displayName}
                {vendor?.status === "SUSPENDED" && (
                  <span className="ml-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                    停權中
                  </span>
                )}
              </p>
              <p className="text-xs text-[var(--vendor-gray-100)]">vendor</p>
              
            </div>
            <Link
              href="/vendor/profile"
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[var(--vendor-gray-400)] font-black text-white transition hover:brightness-110"
              title="個人資料"
            >
              {vendor?.imageUrl ? (
                <img 
                  src={vendor.imageUrl} 
                  alt={`${displayName} 的頭像`}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    // 如果圖片加載失敗（例如網址失效），自動隱藏圖片並顯示字母
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
                  }}
                />
              ) : null}
              {/* Fallback 字母：當沒有 imageUrl 或是圖片加載失敗時顯示 */}
              <span style={{ display: vendor?.imageUrl ? 'none' : 'block' }}>
                {avatarChar}
              </span>
            </Link>
            <button
              onClick={logout}
              className="rounded-md border border-white/20 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              登出
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
