// components/AppealReviewPanel.js — 福委會審核申訴
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AppealReviewPanel({ appealId }) {
  const router = useRouter();
  const [adminNotes, setAdminNotes] = useState("");
  const [refundAmount, setRefundAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(action) {
    const status = action === "approve" ? "approved" : "rejected";
    const refund = action === "approve" ? Number(refundAmount) || 0 : 0;

    const confirmMsg = action === "approve"
      ? `確定核准此申訴嗎？\n退款金額：$${refund}\n\n核准後員工會看到結果並收到退款資訊。`
      : `確定駁回此申訴嗎？\n\n駁回後員工會看到結果與駁回原因。`;
    if (!window.confirm(confirmMsg)) return;

    setSaving(true);
    setError("");
    try {
      // Step 1: 改 申訴 status
      const res = await fetch(`/api/admin/appeals/${appealId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          refund_amount: refund,
          admin_notes: adminNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "操作失敗");

      // Step 2: 寄通知（成功 / 失敗都寄不同訊息）
      try {
        await fetch("/api/admin/appeals/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appealId,
            action,
            refund,
            adminNotes,
            employeeId: data.employee_id,
            vendorId: data.vendor_id,
            orderId: data.order_id,
          }),
        });
      } catch (notifyErr) {
        console.warn("通知寄送失敗，但申訴狀態已更新:", notifyErr);
        // 寄信失敗不擋整體流程
      }

      router.refresh();
    } catch (err) {
      setError(err.message || "操作失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="surface-panel h-fit rounded-lg p-5">
      <p className="text-sm font-bold text-slate-500">審核操作</p>
      <h2 className="mt-1 text-2xl font-black text-[var(--admin-coffee-900)]">處理此申訴</h2>

      {error && (
        <div className="mt-4 rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm font-medium text-[var(--error-fg)]">
          {error}
        </div>
      )}

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">
          退款金額（核准時使用）
        </span>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">$</span>
          <input
            type="number"
            min="0"
            value={refundAmount}
            onChange={(e) => setRefundAmount(e.target.value)}
            placeholder="0"
            className="w-full rounded-md border border-[var(--line)] bg-white py-2.5 pl-8 pr-3 text-sm outline-none transition focus:border-[var(--admin-coffee-400)] focus:ring-2 focus:ring-[var(--admin-coffee-100)]/50"
          />
        </div>
        <p className="mt-1 text-xs text-slate-400">駁回時此欄位無效</p>
      </label>

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">審核備註</span>
        <textarea
          rows="4"
          value={adminNotes}
          onChange={(e) => setAdminNotes(e.target.value)}
          placeholder="範例：確認餐點品質確實有問題，全額退款&#10;範例：證據不足以證明商家錯誤，駁回"
          className="w-full resize-none rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--admin-coffee-400)] focus:ring-2 focus:ring-[var(--admin-coffee-100)]/50"
        />
      </label>

      <div className="mt-5 space-y-2">
        <button
          onClick={() => submit("approve")}
          disabled={saving}
          className="w-full rounded-md bg-[var(--admin-coffee-600)] py-3 text-sm font-bold text-white transition hover:bg-[var(--admin-coffee-700)] disabled:opacity-50"
        >
          {saving ? "處理中..." : "核准退款"}
        </button>
        <button
          onClick={() => submit("reject")}
          disabled={saving}
          className="w-full rounded-md border border-[var(--error-fg)]/30 bg-[var(--error-bg)] py-3 text-sm font-bold text-[var(--error-fg)] transition hover:bg-[var(--error-fg)] hover:text-white disabled:opacity-50"
        >
          {saving ? "處理中..." : "駁回申訴"}
        </button>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        審核完成後員工會在他的申訴頁面看到結果與你的備註
      </p>
    </div>
  );
}