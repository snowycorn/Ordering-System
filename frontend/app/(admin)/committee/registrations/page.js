// app/(admin)/committee/registrations/page.js — 入駐審核列表
import Link from "next/link";
import { cookies } from "next/headers";
import { COOKIE_NAME, SERVICES, apiFetch, jsonOrEmpty } from "@/lib/api";

export const dynamic = "force-dynamic";

const STATUS_META = {
  PENDING: { label: "待審核", className: "bg-[var(--warning-bg)] text-[var(--warning-fg)]" },
  APPROVED: { label: "已核准", className: "bg-[var(--success-bg)] text-[var(--success-fg)]" },
  REJECTED: { label: "已駁回", className: "bg-[var(--error-bg)] text-[var(--error-fg)]" },
};

async function getApplications(filterStatus) {
  if (!SERVICES.vendor) return [];
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  let url = `${SERVICES.vendor}/api/v1/admin/register/applications`;
  if (filterStatus) url += `?status=${encodeURIComponent(filterStatus)}`;
  try {
    const res = await apiFetch(url, { token });
    if (!res.ok) return [];
    const data = await jsonOrEmpty(res);
    return Array.isArray(data) ? data : data.applications || [];
  } catch {
    return [];
  }
}

function formatDate(s) {
  if (!s) return "-";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
  }).format(new Date(s));
}

export default async function RegistrationsPage({ searchParams }) {
  const sp = await searchParams;
  const filter = sp?.status || ""; // "PENDING" / "APPROVED" / "REJECTED" / ""
  const applications = await getApplications(filter);

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="surface-panel rounded-lg p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--admin-coffee-600)]">
              Vendor Registration
            </p>
            <h1 className="mt-2 text-3xl font-black text-[var(--admin-coffee-900)]">入駐審核</h1>
            <p className="mt-1 text-sm text-slate-500">審核外部商家入駐申請，查看營登 PDF 並核准或駁回</p>
          </div>
        </div>

        {/* 狀態篩選 */}
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { value: "", label: "全部" },
            { value: "PENDING", label: "待審核" },
            { value: "APPROVED", label: "已核准" },
            { value: "REJECTED", label: "已駁回" },
          ].map((opt) => {
            const active = (filter || "") === opt.value;
            return (
              <Link
                key={opt.value || "all"}
                href={`/committee/registrations${opt.value ? `?status=${opt.value}` : ""}`}
                className={`rounded-md border px-3 py-1.5 text-sm font-bold transition ${
                  active
                    ? "border-[var(--admin-coffee-600)] bg-[var(--admin-coffee-600)] text-white"
                    : "border-[var(--line)] bg-white text-slate-600 hover:border-[var(--admin-coffee-400)]"
                }`}
              >
                {opt.label}
              </Link>
            );
          })}
        </div>
      </section>

      {/* 列表 */}
      <section className="surface-panel overflow-hidden rounded-lg">
        {!applications.length ? (
          <div className="p-8 text-center text-sm text-slate-500">
            目前沒有{filter ? STATUS_META[filter]?.label || "" : ""}申請
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {applications.map((a) => {
              const meta = STATUS_META[a.status] || { label: a.status, className: "bg-slate-100 text-slate-600" };
              return (
                <Link
                  key={a.id}
                  href={`/committee/registrations/${a.id}`}
                  className="grid gap-3 p-5 transition hover:bg-[var(--surface-muted)] lg:grid-cols-[1fr_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-black text-[var(--admin-coffee-900)]">{a.vendorName}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}>
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      {a.email}・{a.phone || "未提供電話"}・{a.factoryZone || "未指定廠區"}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-slate-400">
                      送出時間：{formatDate(a.createdAt)}
                      {a.reviewedAt && ` · 審核時間：${formatDate(a.reviewedAt)}`}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-[var(--admin-coffee-600)]">查看詳情 →</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}