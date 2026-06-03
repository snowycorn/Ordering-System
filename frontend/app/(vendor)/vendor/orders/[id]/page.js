// app/(vendor)/vendor/orders/[id]/page.js
"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";



const STATUS_LABELS = {
  pending: "待確認",
  ordered: "新訂單 (待處理)",
  confirmed: "已確認",
  preparing: "製作中",
  ready: "餐點已送達/可領取",
  completed: "已完成核銷",
  cancelled: "已取消/已拒單",
};

// 商家狀態推進面板設定
const STATUS_FLOW = {
  pending:   { next: "preparing", label: "開始備餐", color: "bg-[var(--navy-600)] hover:bg-[var(--navy-800)]" },
  ordered:   { next: "preparing", label: "開始備餐", color: "bg-[var(--navy-600)] hover:bg-[var(--navy-800)]" },
  confirmed: { next: "preparing", label: "開始備餐", color: "bg-[var(--navy-600)] hover:bg-[var(--navy-800)]" },
  preparing: { next: "ready", label: "製作完成，通知員工領取", color: "bg-[var(--teal-400)] hover:bg-[var(--teal-600)]" },
  ready:     { next: "completed", label: "員工已取餐，確認核銷", color: "bg-green-600 hover:bg-green-700" },
};

function normalizeOrder(data) {
  const items = Array.isArray(data.items) ? data.items.map(item => {
    const itemPrice = Number(item.total_price ?? item.price ?? item.price_snapshot ?? data.price_snapshot ?? 0);
    return {
      menu_id: item.menu_id,
      name: item.name ?? data.menu_name ?? "未知餐點",
      price: itemPrice,
      quantity: Number(item.quantity ?? data.quantity ?? 1),
    };
  }) : [];

  if (items.length === 0 && (data.menu_name || data.menu_id || data.price_snapshot || data.price)) {
    items.push({
      menu_id: data.menu_id || "unknown",
      name: data.menu_name || "未知餐點",
      price: Number(data.price ?? data.price_snapshot ?? 0),
      quantity: Number(data.quantity ?? 1),
    });
  }

  const computedTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return {
    id: String(data.id).startsWith("ORD-") ? data.id : `ORD-${data.id}`,
    employee_name: data.employee_name ?? data.user_name ?? (data.user_id ? `員工 #${data.user_id}` : "未知員工"),
    factory_zone: data.factoryZone ?? data.factory_zone ?? "未知廠區",
    status: data.status ?? "pending",
    order_date: (data.order_date ?? data.created_at)?.slice(0, 10) ?? "-",
    pickup_date: data.pickup_date ?? data.target_date ?? "-",
    pickup_time: data.pickup_time || "12:20",
    items,
    total_amount: Number(data.total_amount ?? data.total_price ?? computedTotal),
    note: data.note ?? "",
    user_email: data.user_email || data.userId || "企業員工"
  };
}

export default function VendorOrderDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let ignore = false;

    async function loadOrder() {
      setLoading(true);
      setError("");
      try {
        const targetUrl = `/api/vendor/orders/${id}`;

        const res = await fetch(targetUrl, { cache: "no-store" });
        console.log("Fetch order response:", res);
        const data = await res.json().catch(() => ({}));

        if (!res.ok) throw new Error(data.message || "讀取訂單失敗");

        const normalized = normalizeOrder(data);
        if (!ignore) setOrder(normalized);
      } catch (err) {
        if (!ignore) setError(err.message || "讀取訂單失敗");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    if (id) loadOrder();
    return () => { ignore = true; };
  }, [id]);

  // 商家專用：一鍵變更訂單狀態（PATCH）
  async function handleStatusChange(nextStatus) {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const targetUrl = `/api/vendor/orders/${id}`;
      const res = await fetch(targetUrl, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.message || "更新訂單狀態失敗");

      const normalized = normalizeOrder(data);
      setOrder(normalized);
      setMessage(`訂單狀態已成功變更為：${STATUS_LABELS[nextStatus]}`);
      router.refresh();
    } catch (err) {
      setError(err.message || "更新失敗");
    } finally {
      setSaving(false);
    }
  }

  async function handleReject() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const res = await fetch(`/api/vendor/orders/${id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancel_reason: "商家主動拒單/取消" }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "後端拒單處理失敗");

      setOrder((prev) => prev ? { ...prev, status: "cancelled" } : prev);
      setMessage("訂單已成功拒絕/取消");
      router.refresh();
    } catch (err) {
      setError(err.message || "取消失敗");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="surface-panel rounded-lg p-8 text-sm text-slate-500">訂單明細讀取中...</div>;
  }

  if (error && !order) {
    return (
      <div className="surface-panel rounded-lg p-8">
        <p className="text-sm font-semibold text-[var(--error-fg)]">{error}</p>
        <Link href="/vendor/orders" className="mt-4 inline-flex text-sm font-bold text-[var(--navy-600)]">
          ← 返回訂單佇列
        </Link>
      </div>
    );
  }

  const currentStatus = order?.status;
  const isFinalStatus = ["cancelled", "completed"].includes(currentStatus);
  const currentFlow = STATUS_FLOW[currentStatus];

  return (
    <div className="w-full space-y-6">
      {/* 頂部標題列 */}
      <section className="surface-panel rounded-lg px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/vendor/orders" className="text-sm font-bold text-[var(--navy-600)] hover:underline">
          ← 返回訂單佇列
        </Link>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--teal-600)]">
              Vendor Order Control
            </p>
            <h1 className="mt-2 text-2xl font-black text-[var(--navy-900)]">訂單編號 #{order.id}</h1>
          </div>
          <span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-sm font-bold ${
            currentStatus === 'pending' || currentStatus === 'ordered' ? 'bg-blue-50 text-blue-600' :
            currentStatus === 'confirmed' ? 'bg-indigo-50 text-indigo-600' :
            currentStatus === 'preparing' ? 'bg-yellow-50 text-yellow-600' :
            currentStatus === 'ready' ? 'bg-green-50 text-green-600' : 
            currentStatus === 'cancelled' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'
          }`}>
            {STATUS_LABELS[currentStatus] || currentStatus}
          </span>
        </div>
      </section>

      {/* 主內容區 */}
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* 左側：出餐核心資訊 */}
        <div className="surface-panel space-y-6 rounded-lg p-6">
          <div>
            <span className="text-sm font-bold text-slate-500">預計取餐時間: </span>
            <span className="text-base font-black text-slate-900">{order.pickup_date} {order.pickup_time}</span>
          </div>

          <div className="mt-2">
            <span className="text-sm font-bold text-slate-500">配送廠區: </span>
            <span className="text-base font-black text-[var(--navy-600)]">{order.factory_zone}</span>
          </div>

          <div className="border-t border-slate-100 pt-4">
            <div className="space-y-3">
              {order.items.map((item, index) => (
                <div key={index} className="flex items-center text-sm text-slate-700">
                  <span className="w-6 text-slate-400 font-medium">{index + 1}</span>
                  <span className="flex-1 font-bold text-slate-800">{item.name}</span>
                  <span className="w-12 text-slate-500">x {item.quantity}</span>
                  <span className="w-20 text-right font-black text-slate-900">
                    ${(item.price * item.quantity).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="text-base font-black text-slate-900">
              <span>總價: </span>
              <span className="text-lg text-[var(--navy-600)]">${order.total_amount.toLocaleString()}</span>
            </div>
            
            <div className="text-sm font-medium text-slate-700">
              <span className="font-bold text-slate-500">備註: </span>
              <span className={order.note ? "text-slate-800" : "text-slate-400 italic"}>
                {order.note || "(無)"}
              </span>
            </div>
          </div>

          <div className="border-t border-slate-50 pt-2 text-xs text-slate-400">
            員工帳號: {order.user_email} · 下單日期: {order.order_date}
          </div>
        </div>

        {/* 右側：商家狀態管理面板 */}
        <div className="surface-panel flex flex-col justify-between rounded-lg p-6">
          <div>
            <p className="text-sm font-bold text-slate-500">工作台操作</p>
            <h2 className="mt-1 text-2xl font-black text-[var(--navy-900)]">狀態流程控制</h2>
            
            {error && (
              <div className="mt-4 rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm font-medium text-[var(--error-fg)]">
                {error}
              </div>
            )}
            {message && (
              <div className="mt-4 rounded-md bg-[var(--success-bg)] px-3 py-2 text-sm font-medium text-[var(--success-fg)]">
                {message}
              </div>
            )}

            <div className="mt-6">
              {!isFinalStatus && currentFlow ? (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500">訂單預設已接單</p>
                </div>
              ) : (
                <div className="rounded-lg bg-slate-50 py-8 text-center border border-dashed border-slate-200">
                  <p className="text-sm font-bold text-slate-400">
                    {currentStatus === "completed" && "此訂單已完成全流程核銷"}
                    {currentStatus === "cancelled" && "此訂單已被取消/拒單"}
                    {!["completed", "cancelled"].includes(currentStatus) && `目前狀態：${STATUS_LABELS[currentStatus] || currentStatus}`}
                  </p>
                </div>
              )}
            </div>
          </div>

          {!isFinalStatus && (
            <div className="mt-8 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-400 mb-2">若因食材不足或特殊狀況無法出餐：</p>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (window.confirm("確定要拒絕/取消這筆訂單嗎？此操作將發送通知給員工。")) {
                    handleReject();
                  }
                }}
                className="w-full rounded-md border border-[var(--error-fg)]/30 py-2.5 text-xs font-bold text-[var(--error-fg)] transition hover:bg-[var(--error-bg)] disabled:cursor-not-allowed"
              >
                商家主動拒單/取消訂單
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}