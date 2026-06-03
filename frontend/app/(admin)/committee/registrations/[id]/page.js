// app/(admin)/committee/registrations/[id]/page.js — 入駐申請明細
import Link from "next/link";
import { cookies } from "next/headers";
import { COOKIE_NAME, SERVICES, apiFetch, jsonOrEmpty } from "@/lib/api";
import RegistrationReviewPanel from "@/components/RegistrationReviewPanel";

export const dynamic = "force-dynamic";

async function getApplication(id) {
  if (!SERVICES.vendor) return null;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  try {
    const res = await apiFetch(
      `${SERVICES.vendor}/api/v1/admin/register/applications/${encodeURIComponent(id)}`,
      { token }
    );
    if (!res.ok) return null;
    return await jsonOrEmpty(res);
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

export default async function RegistrationDetailPage({ params }) {
  const { id } = await params;
  const app = await getApplication(id);

  if (!app) {
    return (
      <div className="surface-panel mx-auto max-w-[1440px] rounded-lg p-8 text-center">
        <p className="text-sm text-slate-500">找不到這筆入駐申請。</p>
        <Link href="/committee/registrations" className="mt-3 inline-block text-sm font-bold text-[var(--admin-coffee-600)]">
          ← 回入駐審核列表
        </Link>
      </div>
    );
  }

  const isPending = app.status === "PENDING";

  return (
    <div className="space-y-5">
      <Link
        href="/committee/registrations"
        className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 transition hover:text-[var(--admin-coffee-600)]"
      >
        ← 回入駐審核列表
      </Link>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        {/* 左欄：申請資料 + PDF */}
        <div className="space-y-5">
          <section className="surface-panel rounded-lg p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black text-[var(--admin-coffee-900)]">{app.vendorName}</h1>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                app.status === "PENDING"
                  ? "bg-[var(--warning-bg)] text-[var(--warning-fg)]"
                  : app.status === "APPROVED"
                    ? "bg-[var(--success-bg)] text-[var(--success-fg)]"
                    : "bg-[var(--error-bg)] text-[var(--error-fg)]"
              }`}>
                {app.status === "PENDING" ? "待審核" : app.status === "APPROVED" ? "已核准" : "已駁回"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-400">申請 ID：{app.id}</p>

            <dl className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold text-slate-500">聯絡 Email</dt>
                <dd className="mt-1 font-bold text-slate-900">{app.email}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">聯絡電話</dt>
                <dd className="mt-1 font-bold text-slate-900">{app.phone || "未提供"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">申請廠區</dt>
                <dd className="mt-1 font-bold text-slate-900">
                  {Array.isArray(app.factoryZones) && app.factoryZones.length > 0
                    ? app.factoryZones.join("、")
                    : app.factoryZone || "未指定"}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-slate-500">送出時間</dt>
                <dd className="mt-1 font-bold text-slate-900">{formatDate(app.createdAt)}</dd>
              </div>
              {app.reviewedAt && (
                <>
                  <div>
                    <dt className="text-xs font-semibold text-slate-500">審核時間</dt>
                    <dd className="mt-1 font-bold text-slate-900">{formatDate(app.reviewedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-slate-500">審核者</dt>
                    <dd className="mt-1 font-bold text-slate-900">{app.reviewedBy || "—"}</dd>
                  </div>
                </>
              )}
            </dl>

            {app.reviewNotes && (
              <div className="mt-5 rounded-md bg-[var(--surface-muted)] p-4">
                <p className="text-xs font-semibold text-slate-500">審核備註</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">{app.reviewNotes}</p>
              </div>
            )}
          </section>

          {/* 營登 PDF */}
          <section className="surface-panel rounded-lg p-5 sm:p-6">
            <h2 className="text-lg font-black text-[var(--admin-coffee-900)]">營登文件</h2>
            {app.document?.downloadUrl ? (
              <>
                <p className="mt-2 text-sm text-slate-500">點下方按鈕開啟 PDF（連結 5 分鐘內有效）</p>
                <a
                  href={app.document.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-md bg-[var(--admin-coffee-600)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--admin-coffee-700)]"
                >
                  在新分頁開啟 PDF
                </a>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-500">此申請未上傳營登文件</p>
            )}
          </section>
        </div>

        {/* 右欄：審核操作（只有 PENDING 顯示） */}
        {isPending ? (
          <RegistrationReviewPanel applicationId={app.id} vendorName={app.vendorName} />
        ) : (
          <div className="surface-panel h-fit rounded-lg p-5">
            <p className="text-sm font-bold text-slate-500">審核結果</p>
            <p className={`mt-3 rounded-md p-4 text-sm ${
              app.status === "APPROVED"
                ? "bg-[var(--success-bg)] text-[var(--success-fg)]"
                : "bg-[var(--error-bg)] text-[var(--error-fg)]"
            }`}>
              此申請已於 {formatDate(app.reviewedAt)} {app.status === "APPROVED" ? "核准" : "駁回"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}