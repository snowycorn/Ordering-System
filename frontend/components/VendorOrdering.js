// components/VendorOrdering.js — 商家詳情頁的菜單 + 購物車 + 多日期下單
"use client";
import {  useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DateSelector from "@/components/DateSelector";
import { getNextDays } from "@/lib/dates";

export default function VendorOrdering({ vendor, menus, zone }) {
  const router = useRouter();
  const days = useMemo(() => getNextDays(7), []);

  // 初始預設選「第一個非 disabled 的日期」
  const [dates, setDates] = useState(() => {
    const firstAvailable = days.find((d) => !d.disabled);
    return firstAvailable ? [firstAvailable.value] : [];
  });
  const [cart, setCart] = useState({});
  const [stockMap, setStockMap] = useState({});
  // 當日期切換時，重撈該日期的庫存
  useEffect(() => {
    if (dates.length === 0) {
      return;
    }
    // 只查第一個選中的日期（簡化）
    const firstDate = dates[0];
    const menuIds = menus.map((m) => m.id);
    fetch("/api/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menuIds, date: firstDate }),
    })
      .then((r) => (r.ok ? r.json() : { inventory: {} }))
      .then((data) => setStockMap(data.inventory || {}))
      .catch(() => setStockMap({}));
  }, [dates, menus]);

  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const menuById = useMemo(() => {
    const m = {};
    for (const item of menus) m[item.id] = item;
    return m;
  }, [menus]);

  const remainingOf = (menu) => {
    // 先看即時庫存（後端 daily_inventory），沒有再 fallback dailyLimit
    const stock = dates.length === 0 ? undefined : stockMap[menu.id];
    if (stock !== null && stock !== undefined) return Number(stock);
    return Number(menu?.daily_limit ?? menu?.remaining ?? 0);
  };

  const hasAnyStock = (menu) => remainingOf(menu) > 0;

  function addToCart(menuId) {
    if (dates.length === 0) {
      setMessage("請先選擇至少一個取餐日期");
      return;
    }
    setMessage("");
    setCart((c) => {
      const next = { ...c };
      for (const date of dates) {
        const key = `${menuId}_${date}`;
        if (!next[key]) next[key] = { menuId, date, qty: 1 };
      }
      return next;
    });
  }

  function setQty(key, qty) {
    setCart((c) => {
      const next = { ...c };
      const item = next[key];
      if (!item) return next;
      const menu = menuById[item.menuId];
      const max = remainingOf(menu);
      const v = Math.max(0, Math.min(qty, max));
      if (v <= 0) delete next[key];
      else next[key] = { ...item, qty: v };
      return next;
    });
  }

  const cartList = Object.entries(cart).map(([key, item]) => {
    const menu = menuById[item.menuId];
    return {
      key,
      menu,
      date: item.date,
      qty: item.qty,
      subtotal: (menu?.price || 0) * item.qty,
    };
  });
  const totalQty = cartList.reduce((s, i) => s + i.qty, 0);
  const totalAmount = cartList.reduce((s, i) => s + i.subtotal, 0);

  // 購物車按「餐點」分組，讓菜單卡顯示「各日數量」
  const cartByMenu = useMemo(() => {
    const map = {};
    for (const it of cartList) {
      if (!map[it.menu.id]) map[it.menu.id] = [];
      map[it.menu.id].push(it);
    }
    return map;
  }, [cartList]);

  async function checkout() {
    if (!totalQty) return;
    setStatus("loading");
    setMessage("");

    // 按日期分組，一張訂單一個 POST（後端會拆成多個 item）
    const byDate = {};
    for (const it of cartList) {
      if (!byDate[it.date]) byDate[it.date] = [];
      byDate[it.date].push({
        menu_id: it.menu.id,
        name: it.menu.name,
        price: it.menu.price,
        quantity: it.qty,
      });
    }

    let successCount = 0;
    let failedDate = null;
    let failMsg = "";

    for (const [date, items] of Object.entries(byDate)) {
      try {
        const res = await fetch("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            vendorId: vendor.id,
            vendor_id: vendor.id,
            vendor_name: vendor.name,
            targetDate: date,
            target_date: date,
            items,
            factoryZone: zone ? `${zone}廠` : "",
          }),
        });
        const data = await res.json().catch(() => ({}));

        // 後端可能回 207 + failureCount > 0，這代表部分或全部失敗
        const realSuccess = res.ok && (data.failureCount === undefined || data.failureCount === 0);
        if (!realSuccess) {
          failedDate = date;
          failMsg = data.message || "送出失敗";
          break;
        }
        successCount++;
      } catch {
        failedDate = date;
        failMsg = "無法連線";
        break;
      }
    }

    if (failedDate) {
      setStatus("error");
      setMessage(`${failedDate} 送出失敗：${failMsg}（已成功 ${successCount} 天）`);
    } else {
      setStatus("done");
      setMessage(`成功送出 ${Object.keys(byDate).length} 天的訂單！`);
      setCart({});
      router.refresh();
    }
  }

  return (
    <>
      <DateSelector days={days} selected={dates} onChange={setDates} />

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {menus.map((menu) => {
            const remaining = remainingOf(menu);
            const soldOut = !hasAnyStock(menu);
            const inCart = cartByMenu[menu.id] || [];

            return (
              <article
                key={menu.id}
                className="surface-panel flex h-full flex-col overflow-hidden rounded-lg"
              >
                <div className="aspect-[16/10] w-full bg-gradient-to-br from-[var(--navy-50)] via-white to-[var(--teal-50)]">
                  {menu.image_url ? (
                    <div
                      role="img"
                      aria-label={menu.name}
                      className="h-full w-full bg-cover bg-center"
                      style={{ backgroundImage: `url(${menu.image_url})` }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-2xl">🍱</div>
                  )}
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-base font-bold text-[var(--navy-900)]">{menu.name}</h3>
                    <span className="shrink-0 text-lg font-black text-[var(--navy-600)]">
                      ${menu.price}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {(menu.tags || []).slice(0, 3).map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-[var(--success-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--success-fg)]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>

                  {/* 加入購物車後才顯示「各日已選 + 剩餘」 */}
                  {inCart.length > 0 && (
                    <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-xs">
                      {inCart.map(({ key, date, qty }) => {
                        const dayInfo = days.find((d) => d.value === date);
                        return (
                          <div key={key} className="flex items-center justify-between">
                            <span className="text-slate-600">
                              {dayInfo?.label || date}（{date}）
                            </span>
                            <span className="text-slate-500">
                              已選 {qty}，剩 {Math.max(0, remaining - qty)} 份
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => addToCart(menu.id)}
                    disabled={soldOut || dates.length === 0}
                    className="mt-3 w-full rounded-md bg-[var(--navy-600)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--navy-800)] disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {soldOut ? "已售完" : `加入購物車（已選 ${dates.length} 天）`}
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        <aside className="h-fit lg:sticky lg:top-24">
          <div className="surface-panel rounded-lg p-5">
            <h3 className="text-lg font-black text-[var(--navy-900)]">購物車</h3>
            <p className="mt-1 text-xs text-slate-500">{vendor.name}</p>

            {cartList.length ? (
              <ul className="mt-4 space-y-2.5">
                {cartList.map(({ key, menu, date, qty }) => (
                  <li key={key} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{menu.name}</p>
                      <p className="text-xs text-slate-500">
                        {date}・${menu.price} × {qty}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setQty(key, qty - 1)}
                        className="h-7 w-7 rounded bg-[var(--navy-50)] font-bold text-[var(--navy-600)]"
                      >
                        −
                      </button>
                      <span className="w-5 text-center font-bold">{qty}</span>
                      <button
                        onClick={() => setQty(key, qty + 1)}
                        disabled={qty >= remainingOf(menu)}
                        className="h-7 w-7 rounded bg-[var(--navy-50)] font-bold text-[var(--navy-600)] disabled:opacity-40"
                      >
                        ＋
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 rounded-md bg-[var(--surface-muted)] p-4 text-center text-sm text-slate-500">
                {dates.length === 0 ? "請先選擇日期" : "先選擇日期後加入餐點"}
              </p>
            )}

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-sm text-slate-500">合計 {totalQty} 份</span>
              <span className="text-2xl font-black text-[var(--navy-600)]">${totalAmount}</span>
            </div>

            <button
              onClick={checkout}
              disabled={!totalQty || status === "loading"}
              className="mt-4 w-full rounded-md bg-[var(--navy-600)] px-4 py-3 text-sm font-bold text-white transition hover:bg-[var(--navy-800)] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {status === "loading" ? "送出中..." : "送出訂單"}
            </button>

            {message && (
              <p className={`mt-3 text-sm ${status === "error" ? "text-[var(--error-fg)]" : "text-[var(--success-fg)]"}`}>
                {message}
              </p>
            )}
            {status === "done" && (
              <Link
                href="/orders"
                className="mt-2 block text-center text-sm font-bold text-[var(--navy-600)] hover:underline"
              >
                前往查看歷史訂單 →
              </Link>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
