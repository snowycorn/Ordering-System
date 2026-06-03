// app/(admin)/committee/appeals/[id]/page.js — 福委會申訴明細與審核
import Link from "next/link";
import { cookies } from "next/headers";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES,
  apiFetch, jsonOrEmpty, serviceUrl,
} from "@/lib/api";
import AppealReviewPanel from "@/components/AppealReviewPanel";

export const dynamic = "force-dynamic";

async function getAppeal(id) {
  if (!SERVICES.appeal) return null;
  const token = (await cookies()).get(COOKIE_NAME)?.value;

  // 把網址裡的 "APL-5" 拆成 "5"
  const rawId = String(id).replace(/^APL-/, "");

  try {
    const res = await apiFetch(serviceUrl(SERVICES.appeal, ENDPOINTS.appeals), { token });
    if (!res.ok) return null;
    const data = await jsonOrEmpty(res);
    const list = Array.isArray(data) ? data : data.appeals || [];
    return list.find((a) => String(a.id) === rawId) || null;
  } catch {
    return null;
  }
}

function formatDate(s) {
  if (!s) return "-";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
  }).format(new Date(s));
}

const STATUS_LABEL = {
  pending: "待審核",
  approved: "已核准",
  rejected: "已駁回",
};
const STATUS_CLASS = {
  pending: "bg-[var(--warning-bg)] text-[var(--warning-fg)]",
  approved: "bg-[var(--success-bg)] text-[var(--success-fg)]",
  rejected: "bg-[var(--error-bg)] text-[var(--error-fg)]",
};

export default async function AdminAppealDetailPage({ params }) {
  const { id } = await params;
  const appeal = await getAppeal(id);

  if (!appeal) {
    return (
      <div className="surface-panel mx-auto max-w-[1440px] rounded-lg p-8 text-center">
        <p className="text-sm text-slate-500">找不到這筆申訴案件。</p>
        <Link href="/committee/appeals" className="mt-3 inline-block text-sm font-bold text-[var(--admin-coffee-600)]">
          ← 回申訴列表
        </Link>
      </div>
    );
  }

  const isPending = appeal.status === "pending";

  return (
    <div className="space-y-5">
      <Link
        href="/committee/appeals"
        className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 transition hover:text-[var(--admin-coffee-600)]"
      >
        ← 回申訴列表
      </Link>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* 左欄：申訴資料 */}
        <div className="space-y-5">
          <section className="surface-panel rounded-lg p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black text-[var(--admin-coffee-900)]">APL-{appeal.id}</h1>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_CLASS[appeal.status]}`}>
                {STATUS_LABEL[appeal.status] || appeal.status}
              </span>
            </div>

            <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-slate-500">員工 ID</dt>
                <dd className="mt-1 font-bold text-slate-900">{appeal.employee_id}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">訂單 ID</dt>
                <dd className="mt-1 font-bold text-slate-900">{appeal.order_id}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">商家 ID</dt>
                <dd className="mt-1 font-bold text-slate-900">{appeal.vendor_id || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">送出時間</dt>
                <dd className="mt-1 font-bold text-slate-900">{formatDate(appeal.created_at)}</dd>
              </div>
            </dl>
          </section>

          {/* 申訴內容 */}
          <section className="surface-panel rounded-lg p-5 sm:p-6">
            <p className="text-sm font-bold text-slate-500">申訴內容</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
              {appeal.reason}
            </p>
          </section>

          {/* 審核結果（已結案才顯示） */}
          {!isPending && (
            <section className="surface-panel rounded-lg p-5 sm:p-6">
              <p className="text-sm font-bold text-slate-500">審核結果</p>
              <div className="mt-3 space-y-3">
                {Number(appeal.refund_amount) > 0 && (
                  <div className="flex items-center justify-between rounded-md bg-[var(--admin-coffee-50)] p-3">
                    <span className="text-sm font-semibold text-slate-700">退款金額</span>
                    <span className="text-xl font-black text-[var(--admin-coffee-700)]">
                      ${appeal.refund_amount}
                    </span>
                  </div>
                )}
                {appeal.admin_notes && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500">審核備註</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {appeal.admin_notes}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* 右欄：審核操作（pending 才顯示） */}
        {isPending ? (
          <AppealReviewPanel appealId={appeal.id} />
        ) : (
          <div className="surface-panel h-fit rounded-lg p-5">
            <p className="text-sm font-bold text-slate-500">案件狀態</p>
            <p className={`mt-3 rounded-md p-4 text-sm ${STATUS_CLASS[appeal.status]}`}>
              此案件已{STATUS_LABEL[appeal.status]}，無法再次審核
            </p>
          </div>
        )}
      </div>
    </div>
  );
}