// app/register/page.js — 外部商家申請入駐
"use client";

import Link from "next/link";
import { useState } from "react";

const FACTORY_ZONES = [
  { value: "A廠", label: "A 廠" },
  { value: "B廠", label: "B 廠" },
  { value: "C廠", label: "C 廠" },
];

// 驗證碼有效時間（秒）
const CODE_TTL = 300; // 5 分鐘

export default function RegisterPage() {
  const [form, setForm] = useState({
    vendorName: "",
    email: "",
    phone: "",
    factoryZones: [],
  });

  // 驗證碼相關狀態
  const [generatedCode, setGeneratedCode] = useState("");
  const [codeSentAt, setCodeSentAt] = useState(null); // 時間戳
  const [inputCode, setInputCode] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);

  // 檔案上傳
  const [documentsKey, setDocumentsKey] = useState("");
  const [uploading, setUploading] = useState(false);

  // 送出狀態
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(null); // { id }

  function updateField(field, value) {
    setForm((c) => ({ ...c, [field]: value }));
    // 改 email 時，驗證狀態重置
    if (field === "email") {
      setEmailVerified(false);
      setGeneratedCode("");
      setInputCode("");
    }
  }

  function toggleZone(z) {
    setForm((c) => ({
      ...c,
      factoryZones: c.factoryZones.includes(z)
        ? c.factoryZones.filter((x) => x !== z)
        : [...c.factoryZones, z],
    }));
  }

  // 產生 6 位數驗證碼 + 呼叫後端寄信
  async function sendVerificationCode() {
    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError("請先填寫正確的 Email");
      return;
    }
    setSendingCode(true);
    setError("");
    const code = String(Math.floor(100000 + Math.random() * 900000));

    try {
      const res = await fetch("/api/register/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "寄送驗證信失敗");
      }
      setGeneratedCode(code);
      setCodeSentAt(Date.now());
      setEmailVerified(false);
    } catch (err) {
      setError(err.message || "寄送驗證信失敗");
    } finally {
      setSendingCode(false);
    }
  }

  // 驗證使用者輸入的驗證碼
  function verifyCode() {
    if (!codeSentAt) {
      setError("請先點「發送驗證碼」");
      return;
    }
    if ((Date.now() - codeSentAt) / 1000 > CODE_TTL) {
      setError("驗證碼已過期，請重新發送");
      setGeneratedCode("");
      setCodeSentAt(null);
      return;
    }
    if (inputCode !== generatedCode) {
      setError("驗證碼錯誤");
      return;
    }
    setEmailVerified(true);
    setError("");
  }

  // 上傳營登 PDF
  async function uploadPdf(file) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("請選擇 PDF 檔");
      return;
    }
    setUploading(true);
    setError("");
    try {
      // Step 1: 跟後端拿 Pre-signed URL
      const urlRes = await fetch("/api/register/upload-url");
      if (!urlRes.ok) throw new Error("無法取得上傳網址");
      const { uploadUrl, documentKey } = await urlRes.json();

      // Step 2: 直接 PUT 到 S3
      const putRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });
      if (!putRes.ok) throw new Error("PDF 上傳失敗");

      setDocumentsKey(documentKey);
    } catch (err) {
      setError(err.message || "PDF 上傳失敗");
    } finally {
      setUploading(false);
    }
  }

  // 送出申請
  async function submit(e) {
    e.preventDefault();
    if (!emailVerified) {
      setError("請先完成 Email 驗證");
      return;
    }
    if (form.factoryZones.length === 0) {
      setError("請至少選一個廠區");
      return;
    }
    if (!documentsKey) {
      setError("請上傳營登 PDF");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/register/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorName: form.vendorName,
          email: form.email,
          phone: form.phone,
          factoryZones: form.factoryZones,
          documentsKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "申請失敗");
      setSuccess(data);
    } catch (err) {
      setError(err.message || "申請失敗");
    } finally {
      setSubmitting(false);
    }
  }

  // 申請成功畫面
  if (success) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[var(--navy-900)] to-[var(--admin-coffee-900)] px-4 py-12 text-white">
        <div className="mx-auto max-w-xl">
          <div className="surface-panel rounded-lg p-8">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--teal-600)]">
              Application Submitted
            </p>
            <h1 className="mt-3 text-3xl font-black text-[var(--navy-900)]">入駐申請已送出</h1>
            <p className="mt-3 text-sm text-slate-600">
              福委會將於 3 ~ 5 個工作天內完成審核，審核結果會以 Email 通知您。
            </p>

            <div className="mt-6 rounded-md bg-[var(--admin-coffee-50)] p-4">
              <p className="text-xs font-bold text-[var(--admin-coffee-700)]">
                申請編號（請務必保留）
              </p>
              <p className="mt-2 break-all font-mono text-sm font-black text-[var(--admin-coffee-900)]">
                {success.id}
              </p>
              <p className="mt-2 text-xs text-slate-600">
                可用此編號查詢審核進度。也已發送至您的 Email：{form.email}
              </p>
            </div>

            <Link
              href="/login"
              className="mt-6 inline-flex w-full justify-center rounded-md bg-[var(--navy-600)] py-2.5 text-sm font-bold text-white transition hover:bg-[var(--navy-800)]"
            >
              回登入頁
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-[var(--navy-900)] to-[var(--admin-coffee-900)] px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
        >
          ← 回登入頁
        </Link>

        <div className="surface-panel mt-5 rounded-lg p-6 sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[var(--teal-600)]">
            Vendor Registration
          </p>
          <h1 className="mt-2 text-3xl font-black text-[var(--navy-900)]">商家入駐申請</h1>
          <p className="mt-2 text-sm text-slate-500">
            請填寫公司資料、驗證 Email、上傳營登文件。福委會審核通過後，會寄送商家登入帳號至您的信箱。
          </p>

          {error && (
            <div className="mt-5 rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm font-medium text-[var(--error-fg)]">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            {/* 公司名稱 */}
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">公司 / 店家名稱 *</span>
              <input
                value={form.vendorName}
                onChange={(e) => updateField("vendorName", e.target.value)}
                required
                placeholder="例如：好吃便當"
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--teal-400)]"
              />
            </label>

            {/* Email + 驗證碼 */}
            <div className="space-y-2">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">聯絡 Email *</span>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    required
                    placeholder="contact@example.com"
                    disabled={emailVerified}
                    className="flex-1 rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--teal-400)] disabled:bg-slate-50"
                  />
                  <button
                    type="button"
                    onClick={sendVerificationCode}
                    disabled={sendingCode || emailVerified || !form.email}
                    className="shrink-0 rounded-md border border-[var(--teal-400)] bg-white px-4 text-sm font-bold text-[var(--teal-600)] transition hover:bg-[var(--teal-50)] disabled:opacity-50"
                  >
                    {sendingCode ? "寄送中..." : emailVerified ? "已驗證" : "發送驗證碼"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  審核通過後，登入帳號會以此 Email 為準
                </p>
              </label>

              {/* 驗證碼欄位（只在已發送、未驗證時顯示） */}
              {generatedCode && !emailVerified && (
                <div className="rounded-md bg-[var(--teal-50)] p-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-[var(--teal-600)]">
                      輸入 6 位數驗證碼（{Math.floor(CODE_TTL / 60)} 分鐘內有效）
                    </span>
                    <div className="flex gap-2">
                      <input
                        value={inputCode}
                        onChange={(e) => setInputCode(e.target.value)}
                        maxLength={6}
                        placeholder="輸入信件中的 6 位數字"
                        className="flex-1 rounded-md border border-[var(--teal-200)] bg-white px-3 py-2 text-sm font-mono outline-none focus:border-[var(--teal-400)]"
                      />
                      <button
                        type="button"
                        onClick={verifyCode}
                        className="shrink-0 rounded-md bg-[var(--teal-600)] px-4 text-sm font-bold text-white transition hover:bg-[var(--teal-700)]"
                      >
                        驗證
                      </button>
                    </div>
                  </label>
                </div>
              )}

              {emailVerified && (
                <p className="rounded-md bg-[var(--success-bg)] px-3 py-2 text-sm font-semibold text-[var(--success-fg)]">
                  ✓ Email 驗證成功
                </p>
              )}
            </div>

            {/* 電話 */}
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-slate-700">聯絡電話</span>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                placeholder="0912345678"
                className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--teal-400)]"
              />
            </label>

            {/* 廠區（多選） */}
            <div>
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                想服務的廠區 *（可多選）
              </span>
              <div className="grid grid-cols-3 gap-2">
                {FACTORY_ZONES.map((z) => {
                  const checked = form.factoryZones.includes(z.value);
                  return (
                    <label
                      key={z.value}
                      className={`flex cursor-pointer items-center justify-center gap-2 rounded-md border p-3 text-sm font-semibold transition ${
                        checked
                          ? "border-[var(--teal-400)] bg-[var(--teal-50)] text-[var(--teal-600)]"
                          : "border-[var(--line)] bg-white text-slate-600 hover:border-slate-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleZone(z.value)}
                        className="sr-only"
                      />
                      {z.label}
                    </label>
                  );
                })}
              </div>
            </div>

            {/* PDF 上傳 */}
            <div>
              <span className="mb-1 block text-sm font-semibold text-slate-700">營業登記文件 (PDF) *</span>
              <label
                className={`flex cursor-pointer items-center justify-center rounded-md border-2 border-dashed p-6 transition ${
                  documentsKey
                    ? "border-[var(--success-fg)] bg-[var(--success-bg)]"
                    : "border-[var(--line)] bg-[var(--surface-muted)] hover:bg-slate-100"
                }`}
              >
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => uploadPdf(e.target.files?.[0])}
                  disabled={uploading}
                  className="sr-only"
                />
                <span className="text-sm font-semibold text-slate-600">
                  {uploading
                    ? "上傳中..."
                    : documentsKey
                      ? "✓ PDF 已上傳，可點此重新選擇檔案"
                      : "點此選擇 PDF 檔（最大 10MB）"}
                </span>
              </label>
            </div>

            {/* 送出按鈕 */}
            <button
              type="submit"
              disabled={submitting || !emailVerified || !documentsKey || form.factoryZones.length === 0}
              className="mt-4 w-full rounded-md bg-[var(--navy-600)] py-3 text-sm font-bold text-white transition hover:bg-[var(--navy-800)] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {submitting ? "送出申請中..." : "送出申請"}
            </button>

            <p className="text-center text-xs text-slate-400">
              送出後福委會將進行人工審核，3 ~ 5 個工作天內以 Email 通知結果
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}