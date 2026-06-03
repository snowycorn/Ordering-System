"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function MenuCard({ menu, date }) {
  const router = useRouter();
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");

  const remaining = Number(menu.daily_limit ?? menu.remaining ?? 0);
  const soldOut = remaining <= 0;
  const vendorName = menu.vendor_name || menu.vendorName || "合作商家";

  async function order() {
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menuId: menu.id,
          menu_id: menu.id,
          vendorId: menu.vendor_id,
          vendor_id: menu.vendor_id,
          quantity: 1,
          targetDate: date,    // ← 預訂日期
          target_date: date,   // ← 後端慣用 snake_case 也一起帶，較保險
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setStatus("error");
        setMessage(data.message || "下單失敗，請稍後再試");
        return;
      }

      setStatus("done");
      setMessage("已建立訂單");
      router.refresh();
    } catch {
      setStatus("error");
      setMessage("無法連線，請稍後再試");
    }
  }

  return (
    <article className="surface-panel flex h-full flex-col overflow-hidden rounded-lg transition hover:-translate-y-0.5 hover:border-[var(--teal-200)] hover:shadow-lg">
      <div className="aspect-[16/10] w-full bg-gradient-to-br from-[var(--navy-50)] via-white to-[var(--teal-50)]">
        {menu.image_url ? (
          <div
            role="img"
            aria-label={menu.name}
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${menu.image_url})` }}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-md border border-[var(--navy-100)] bg-white px-4 py-3 text-center shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--navy-600)]">TSMC</div>
              <div className="mt-1 text-sm font-semibold text-slate-700">Lunch</div>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[var(--navy-900)]">{menu.name}</h3>
            <p className="mt-1 text-sm text-slate-500">{vendorName}</p>
          </div>
          <span className="shrink-0 text-lg font-black text-[var(--navy-600)]">${menu.price}</span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {(menu.tags || []).slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-[var(--success-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--success-fg)]">
              {tag}
            </span>
          ))}
          {menu.category && (
            <span className="rounded-full bg-[var(--navy-50)] px-2.5 py-1 text-xs font-semibold text-[var(--navy-600)]">
              {menu.category}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-sm">
          <span className="text-slate-500">剩餘</span>
          <span className={soldOut ? "font-bold text-[var(--error-fg)]" : "font-bold text-slate-900"}>
            {remaining} 份
          </span>
        </div>

        {date && <p className="mt-2 text-xs text-slate-400">預訂日期：{date}</p>}

        <button
          onClick={order}
          disabled={soldOut || status === "loading" || status === "done"}
          className="mt-3 w-full rounded-md bg-[var(--navy-600)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--navy-800)] disabled:bg-slate-300"
        >
          {soldOut ? "已售完" : status === "done" ? "已下單" : status === "loading" ? "下單中..." : "訂購"}
        </button>

        {message && (
          <p className={`mt-2 text-sm ${status === "error" ? "text-[var(--error-fg)]" : "text-[var(--success-fg)]"}`}>
            {message}
          </p>
        )}
      </div>
    </article>
  );
}