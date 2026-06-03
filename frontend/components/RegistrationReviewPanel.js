// components/RegistrationReviewPanel.js — 審核操作面板
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegistrationReviewPanel({ applicationId, vendorName }) {
  const router = useRouter();
  const [reviewNotes, setReviewNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // 成功時存 { tempPassword? }

  async function submit(action) {
    const confirmMsg = action === "approve"
      ? `確定要核准「${vendorName}」入駐嗎？\n系統會自動建立帳號並寄出歡迎信。`
      : `確定要駁回「${vendorName}」嗎？`;
    if (!window.confirm(confirmMsg)) return;

    setSaving(true);
    setError("");
    try {
      // Step 1: 改 status + 取得 tempPassword
      const res = await fetch(`/api/admin/registrations/${applicationId}?action=${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewNotes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "操作失敗");

      // Step 2: 寄信通知商家
      try {
        const emailRes = await fetch("/api/admin/registrations/send-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            email: data.email,
            // 核准：用 tempPassword 當密碼
            ...(action === "approve" && {
              account: data.email,
              password: data.tempPassword,
            }),
            // 駁回：用 reviewNotes 當理由
            ...(action === "reject" && {
              reason: reviewNotes || "未提供理由",
            }),
          }),
        });
        if (!emailRes.ok) {
          // 信寄失敗不擋整個流程，只警告
          console.warn("寄信失敗，但 status 已更新成功");
        }
      } catch (emailErr) {
        console.warn("寄信失敗:", emailErr);
      }

      setResult(data);
      //router.refresh();
    } catch (err) {
      setError(err.message || "操作失敗");
    } finally {
      setSaving(false);
    }
  }

  // 操作完成
  // 操作完成
  if (result) {
    return (
      <div className="surface-panel h-fit rounded-lg p-5">
        <p className="text-sm font-bold text-slate-500">審核結果</p>
        <div className="mt-3 rounded-md bg-[var(--success-bg)] p-4 text-sm text-[var(--success-fg)]">
          <p className="font-bold">操作成功</p>
          <p className="mt-1">後端已建立帳號並寄出歡迎信。</p>
        </div>
        {result.tempPassword && (
          <div className="mt-4 rounded-md border-2 border-[var(--warning-fg)] bg-[var(--warning-bg)] p-4">
            <p className="text-xs font-bold text-[var(--warning-fg)]">
              初始密碼（只顯示一次，請記下！）
            </p>
            <p className="mt-2 break-all font-mono text-lg font-black text-[var(--warning-fg)]">
              {result.tempPassword}
            </p>
            <button
              onClick={() => {
                navigator.clipboard.writeText(result.tempPassword);
                alert("已複製到剪貼簿！");
              }}
              className="mt-3 rounded-md bg-white px-3 py-1.5 text-xs font-bold text-[var(--warning-fg)] hover:bg-slate-50"
            >
              複製密碼
            </button>
            <p className="mt-2 text-xs text-slate-500">
              密碼已透過歡迎信寄給商家，可備份此處
            </p>
          </div>
        )}
        <button
          onClick={() => router.refresh()}
          className="mt-5 w-full rounded-md bg-[var(--admin-coffee-600)] py-2.5 text-sm font-bold text-white transition hover:bg-[var(--admin-coffee-700)]"
        >
          我已記下密碼，關閉視窗
        </button>
      </div>
    );
  }

  return (
    <div className="surface-panel h-fit rounded-lg p-5">
      <p className="text-sm font-bold text-slate-500">審核操作</p>
      <h2 className="mt-1 text-2xl font-black text-[var(--admin-coffee-900)]">填寫審核意見</h2>

      {error && (
        <div className="mt-4 rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm font-medium text-[var(--error-fg)]">
          {error}
        </div>
      )}

      <label className="mt-4 block">
        <span className="mb-1 block text-sm font-semibold text-slate-700">審核備註（選填）</span>
        <textarea
          rows="4"
          value={reviewNotes}
          onChange={(e) => setReviewNotes(e.target.value)}
          placeholder="核准範例：文件齊全，核准通過&#10;駁回範例：營登文件過期，請更新後重新申請"
          className="w-full resize-none rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--admin-coffee-400)] focus:ring-2 focus:ring-[var(--admin-coffee-100)]/50"
        />
      </label>

      <div className="mt-5 space-y-2">
        <button
          onClick={() => submit("approve")}
          disabled={saving}
          className="w-full rounded-md bg-[var(--admin-coffee-600)] py-3 text-sm font-bold text-white transition hover:bg-[var(--admin-coffee-700)] disabled:opacity-50"
        >
          {saving ? "處理中..." : "核准入駐"}
        </button>
        <button
          onClick={() => submit("reject")}
          disabled={saving}
          className="w-full rounded-md border border-[var(--error-fg)]/30 bg-[var(--error-bg)] py-3 text-sm font-bold text-[var(--error-fg)] transition hover:bg-[var(--error-fg)] hover:text-white disabled:opacity-50"
        >
          {saving ? "處理中..." : "駁回申請"}
        </button>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        核准後系統會自動建立帳號、寄歡迎信給商家。一次性初始密碼會在此顯示，請保留以備備援。
      </p>
    </div>
  );
}