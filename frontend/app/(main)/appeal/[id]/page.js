// app/(main)/appeal/[id]/page.js — 申訴明細
import Link from "next/link";
import { cookies } from "next/headers";
import { COOKIE_NAME, ENDPOINTS, SERVICES, USE_LOCAL_MOCKS, apiFetch, jsonOrEmpty, serviceUrl } from "@/lib/api";
import { getMockAppeal } from "@/lib/mockData";

export const dynamic = "force-dynamic";

const REASON_LABELS = { wrong_item: "餐點內容不符", late_delivery: "送達延遲", payment_issue: "薪資扣款問題", cancel_issue: "取消訂單問題", other: "其他" };
// 兩階段：送出 → 結案（含駁回）
const STATUS_STEP = {
  submitted: 1,  // pending → 停在第 1 格
  resolved: 2,   // approved → 走到第 2 格
  rejected: 2,   // rejected → 也是第 2 格（但用紅色標示）
};
const STEPS = ["已送出申訴", "已結案"];

function statusLabel(s) {
  return { submitted: "已送出", reviewing: "審核中", notified: "通知處理中", resolved: "已結案", rejected: "未通過" }[s] || s || "未知";
}

async function getAppeal(id) {
  if (USE_LOCAL_MOCKS || !SERVICES.appeal) return getMockAppeal(id);

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const userId = cookieStore.get("userId")?.value;
  const role = cookieStore.get("role")?.value;

  // 把前端的 "APL-1" 拆出後端的 "1"
  const rawId = String(id).replace(/^APL-/, "");

  // admin 打 /appeals（全部）；employee 打 /appeals/user/:userId（自己的）
  const path = role === "admin"
    ? ENDPOINTS.appeals
    : `${ENDPOINTS.appeals}/user/${encodeURIComponent(userId)}`;

  try {
    const res = await apiFetch(serviceUrl(SERVICES.appeal, path), { token });
    if (!res.ok) return getMockAppeal(id);

    const data = await jsonOrEmpty(res);
    const list = Array.isArray(data) ? data : data.appeals || [];
    const found = list.find((a) => String(a.id) === rawId);
    if (!found) return null;

    // 翻譯後端格式（reason 是「[類型代碼] 描述」混合，或純文字）
    let reasonCode = "other";
    let message = found.reason || "";
    const m = /^\[([^\]]+)\]\s*(.*)$/s.exec(message);
    if (m) { reasonCode = m[1]; message = m[2]; }

    let status = found.status;
    if (status === "pending") status = "submitted";
    else if (status === "approved") status = "resolved";

    return {
      id: `APL-${found.id}`,
      raw_id: found.id,
      order_id: found.order_id,
      employee_id: found.employee_id,
      reason: reasonCode,
      message,
      status,
      refund_amount: found.refund_amount,
      admin_notes: found.admin_notes,
      created_at: found.created_at,
    };
  } catch {
    return getMockAppeal(id);
  }
}

function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-TW", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export default async function AppealDetailPage({ params }) {
  const { id } = await params;
  const appeal = await getAppeal(id);

  if (!appeal) {
    return (
      <div className="surface-panel mx-auto max-w-[1440px] rounded-lg p-8 text-center">
        <p className="text-sm text-slate-500">找不到這筆申訴案件。</p>
        <Link href="/appeal" className="mt-3 inline-block text-sm font-bold text-[var(--navy-600)]">← 回申訴列表</Link>
      </div>
    );
  }

  const currentStep = STATUS_STEP[appeal.status] || 1;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5">
      <Link href="/appeal" className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 transition hover:text-[var(--navy-600)]">← 回申訴列表</Link>

      <section className="surface-panel rounded-lg px-4 py-5 sm:px-6 lg:px-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--teal-600)]">Appeal Detail</p>
        <h1 className="mt-2 text-3xl font-black text-[var(--navy-900)]">{appeal.id}</h1>
        <p className="mt-1 text-sm text-slate-500">建立時間：{formatDate(appeal.created_at)}</p>
      </section>

      {/* 進度（兩階段：送出 → 結案） */}
      <section className="rounded-lg bg-[var(--navy-900)] p-6 text-white">
        <p className="text-sm font-bold text-[var(--teal-200)]">處理進度</p>
        <div className="mt-5 flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-4">
          {STEPS.map((label, idx) => {
            const stepNo = idx + 1;
            const done = stepNo <= currentStep;
            const isLast = idx === STEPS.length - 1;
            const isRejected = appeal.status === "rejected" && isLast && done;

            // 第二格（結案）的文字依結果調整
            const displayLabel = isLast && done
              ? (appeal.status === "rejected" ? "已駁回" : "已核准")
              : label;

            return (
              <div key={label} className="flex flex-1 items-center gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black ${
                    isRejected
                      ? "bg-[var(--error-bg)] text-[var(--error-fg)]"
                      : done
                        ? "bg-[var(--teal-200)] text-[var(--navy-900)]"
                        : "bg-white/10 text-white/60"
                  }`}
                >
                  {isRejected ? "✕" : done ? "✓" : stepNo}
                </span>
                <div className="flex-1">
                  <p className={`text-sm ${done ? "font-bold text-white" : "text-white/60"}`}>{displayLabel}</p>
                  {isLast && done && appeal.refund_amount > 0 && (
                    <p className="mt-0.5 text-xs text-[var(--teal-200)]">退款金額：${appeal.refund_amount}</p>
                  )}
                </div>
                {!isLast && (
                  <span className={`hidden sm:block h-0.5 flex-1 ${done ? "bg-[var(--teal-200)]" : "bg-white/10"}`}></span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 申訴內容 */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="surface-panel rounded-lg p-5">
          <p className="text-sm font-bold text-slate-500">申訴資訊</p>
          <dl className="mt-4 grid gap-3 text-sm">
            <Row label="申訴類型" value={REASON_LABELS[appeal.reason] || appeal.reason} />
            <Row label="關聯訂單" value={appeal.order_id} link={appeal.order_id ? `/orders/${appeal.order_id}` : null} />
            {/* <Row label="申訴人" value={appeal.employee_name} /> */}
            <Row label="目前狀態" value={statusLabel(appeal.status)} />
          </dl>
        </div>

        <div className="surface-panel rounded-lg p-5">
          <p className="text-sm font-bold text-slate-500">問題描述</p>
          <p className="mt-3 text-sm leading-7 text-slate-700">{appeal.message || "（無描述）"}</p>
        </div>
      </section>
    </div>
  );
}

function Row({ label, value, link }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-bold text-slate-900">
        {link && value ? <Link href={link} className="text-[var(--navy-600)] hover:underline">{value}</Link> : value || "-"}
      </dd>
    </div>
  );
}