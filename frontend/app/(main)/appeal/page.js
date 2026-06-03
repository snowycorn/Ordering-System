// app/(main)/appeal/page.js — 申訴列表
import Link from "next/link";
import { cookies } from "next/headers";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES, USE_LOCAL_MOCKS,
  apiFetch, jsonOrEmpty, serviceUrl,
} from "@/lib/api";
import { MOCK_APPEALS } from "@/lib/mockData";

export const dynamic = "force-dynamic";

const STATUS_META = {
  submitted: { label: "已送出", className: "bg-[var(--navy-50)] text-[var(--navy-600)]" },
  reviewing: { label: "審核中", className: "bg-[var(--warning-bg)] text-[var(--warning-fg)]" },
  notified: { label: "通知處理中", className: "bg-[var(--teal-50)] text-[var(--teal-600)]" },
  resolved: { label: "已結案", className: "bg-[var(--success-bg)] text-[var(--success-fg)]" },
  rejected: { label: "未通過", className: "bg-[var(--error-bg)] text-[var(--error-fg)]" },
};
const REASON_LABELS = {
  wrong_item: "餐點內容不符",
  late_delivery: "送達延遲",
  payment_issue: "薪資扣款問題",
  cancel_issue: "取消訂單問題",
  other: "其他",
};

async function getAppeals() {
  if (USE_LOCAL_MOCKS || !SERVICES.appeal) return MOCK_APPEALS;

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const userId = cookieStore.get("userId")?.value;
  const role = cookieStore.get("role")?.value;

  if (!token) return MOCK_APPEALS;

  // admin 打 /appeals（看全部）；employee 打 /appeals/user/:userId（只看自己）
  const path =
    role === "admin"
      ? ENDPOINTS.appeals
      : `${ENDPOINTS.appeals}/user/${encodeURIComponent(userId)}`;

  try {
    const res = await apiFetch(serviceUrl(SERVICES.appeal, path), { token });
    if (!res.ok) return MOCK_APPEALS;

    const data = await jsonOrEmpty(res);
    const list = Array.isArray(data) ? data : data.appeals || [];

    return list.map((a) => {
      let reasonCode = "other";
      let message = a.reason || "";
      const m = /^\[([^\]]+)\]\s*(.*)$/s.exec(message);
      if (m) {
        reasonCode = m[1];
        message = m[2];
      }

      let status = a.status;
      if (status === "pending") status = "submitted";
      else if (status === "approved") status = "resolved";

      return {
        id: `APL-${a.id}`,
        raw_id: a.id,
        order_id: a.order_id,
        employee_id: a.employee_id,
        reason: reasonCode,
        message,
        status,
        created_at: a.created_at,
      };
    });
  } catch {
    return MOCK_APPEALS;
  }
}

function statusMeta(s) {
  return STATUS_META[s] || { label: s || "未知", className: "bg-slate-100 text-slate-600" };
}
function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default async function AppealPage() {
  const appeals = await getAppeals();

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <section className="surface-panel rounded-lg px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--teal-600)]">Appeal</p>
            <h1 className="mt-2 text-3xl font-black text-[var(--navy-900)]">訂單申訴</h1>
            <p className="mt-2 text-sm text-slate-600">查看歷史申訴與處理進度，或建立新的申訴案件。</p>
          </div>
          <Link
            href="/appeal/new"
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--navy-600)] px-4 text-sm font-bold text-white transition hover:bg-[var(--navy-800)]"
          >
            ＋ 新增申訴案件
          </Link>
        </div>
      </section>

      <section className="surface-panel overflow-hidden rounded-lg">
        {!appeals.length ? (
          <div className="p-8 text-center text-sm text-slate-500">
            目前沒有申訴紀錄，點右上角「新增申訴案件」建立。
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {appeals.map((a) => {
              const meta = statusMeta(a.status);
              return (
                <Link
                  key={a.id}
                  href={`/appeal/${a.id}`}
                  className="grid gap-3 p-5 transition hover:bg-[var(--surface-muted)] lg:grid-cols-[1fr_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-black text-[var(--navy-900)]">{a.id}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      訂單 {a.order_id}・{REASON_LABELS[a.reason] || a.reason}
                    </p>
                    <p className="mt-1 line-clamp-1 text-sm text-slate-500">{a.message}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-400">
                      {formatDate(a.created_at)}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-[var(--navy-600)]">查看進度 →</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}