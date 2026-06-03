// app/(main)/appeal/new/page.js — 新增申訴
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const reasons = [
  { value: "wrong_item", label: "餐點內容不符" },
  { value: "late_delivery", label: "送達延遲" },
  { value: "payment_issue", label: "薪資扣款問題" },
  { value: "cancel_issue", label: "取消訂單問題" },
  { value: "other", label: "其他" },
];

function orderLabel(order) {
  return `${order.id}・${order.vendor_name || "商家"}`;
}

export default function NewAppealPage() {
  const [orders, setOrders] = useState([]);
  const [form, setForm] = useState({ orderId: "", reason: "wrong_item", message: "" });
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOrders() {
      try {
        const res = await fetch("/api/orders");
        const data = await res.json().catch(() => []);
        const list = Array.isArray(data) ? data : data.orders || [];
        setOrders(list);
        if (list[0]) setForm((c) => ({ ...c, orderId: list[0].id }));
      } catch {
        setOrders([]);
      }
    }
    loadOrders();
  }, []);

  function updateField(field, value) {
    setForm((c) => ({ ...c, [field]: value }));
  }

  async function submitAppeal(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const rawOrderId = String(form.orderId).replace(/^ORD-/, "");
      const res = await fetch("/api/appeals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: rawOrderId,
          order_id: rawOrderId,
          reason: form.reason,
          message: form.message,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "申訴送出失敗");
      setNotice(`申訴已送出，案件編號：${data.id || "待後端回填"}`);
      setForm((c) => ({ ...c, message: "" }));
    } catch (err) {
      setError(err.message || "申訴送出失敗");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[820px] space-y-5">
      <Link href="/appeal" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 transition hover:text-[var(--navy-600)]">← 回申訴列表</Link>

      <section className="surface-panel rounded-lg px-4 py-5 sm:px-6">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--teal-600)]">New Appeal</p>
        <h1 className="mt-2 text-2xl font-black text-[var(--navy-900)]">新增申訴案件</h1>
      </section>

      <form onSubmit={submitAppeal} className="surface-panel rounded-lg p-5 sm:p-6">
        {notice && (
          <div className="mb-4 rounded-md bg-[var(--success-bg)] px-3 py-2 text-sm font-medium text-[var(--success-fg)]">
            {notice}　<Link href="/appeal" className="font-bold underline">回申訴列表</Link>
          </div>
        )}
        {error && <div className="mb-4 rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm font-medium text-[var(--error-fg)]">{error}</div>}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">關聯訂單</span>
            <select value={form.orderId} onChange={(e) => updateField("orderId", e.target.value)} className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--teal-400)] focus:ring-2 focus:ring-[var(--teal-200)]/50">
              {orders.map((order) => (
                <option key={order.id} value={order.id}>{orderLabel(order)}</option>
              ))}
              {!orders.length && <option value="">目前沒有可選訂單</option>}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">申訴類型</span>
            <select value={form.reason} onChange={(e) => updateField("reason", e.target.value)} className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--teal-400)] focus:ring-2 focus:ring-[var(--teal-200)]/50">
              {reasons.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
        </div>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-semibold text-slate-700">問題描述</span>
          <textarea rows="7" value={form.message} onChange={(e) => updateField("message", e.target.value)} required placeholder="請描述發生時間、餐點狀況或扣款問題" className="w-full resize-none rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--teal-400)] focus:ring-2 focus:ring-[var(--teal-200)]/50" />
        </label>

        <button disabled={loading || !form.orderId} className="mt-5 min-h-11 w-full rounded-md bg-[var(--navy-600)] px-6 text-sm font-bold text-white transition hover:bg-[var(--navy-800)] disabled:cursor-not-allowed disabled:bg-slate-300">
          {loading ? "送出中..." : "送出申訴"}
        </button>
      </form>
    </div>
  );
}