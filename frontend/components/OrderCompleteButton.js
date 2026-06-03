// components/OrderCompleteButton.js — 確認收貨按鈕
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OrderCompleteButton({ orderId, status }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // 只有 confirmed 狀態才顯示「確認收貨」按鈕
  if (status !== "confirmed") return null;

  async function handleComplete(e) {
    e.stopPropagation();
    e.preventDefault();

    if (!window.confirm("確認已收到此訂單？\n確認後將通知商家完成此筆交易。")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.detail || "確認失敗");
      router.refresh();
    } catch (err) {
      alert(err.message || "確認失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleComplete}
      disabled={loading}
      className="rounded-md border border-[var(--success-fg)]/30 bg-[var(--success-bg)] px-3 py-2 text-sm font-bold text-[var(--success-fg)] transition hover:bg-[var(--success-fg)] hover:text-white disabled:opacity-50"
    >
      {loading ? "處理中..." : "確認收貨"}
    </button>
  );
}