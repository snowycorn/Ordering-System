// app/(admin)/committee/appeals/page.js — 福委會申訴處理列表
import Link from "next/link";
import { cookies } from "next/headers";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES,
  apiFetch, jsonOrEmpty, serviceUrl,
} from "@/lib/api";

export const dynamic = "force-dynamic";

const STATUS_META = {
  submitted: { label: "待審核", className: "bg-[var(--warning-bg)] text-[var(--warning-fg)]" },
  resolved: { label: "已核准", className: "bg-[var(--success-bg)] text-[var(--success-fg)]" },
  rejected: { label: "已駁回", className: "bg-[var(--error-bg)] text-[var(--error-fg)]" },
};

const REASON_LABELS = {
  wrong_item: "餐點內容不符",
  late_delivery: "送達延遲",
  payment_issue: "薪資扣款問題",
  cancel_issue: "取消訂單問題",
  other: "其他",
};

// 後端 status → 前端 status
function mapStatusFromBackend(s) {
  if (s === "pending") return "submitted";
  if (s === "approved") return "resolved";
  if (s === "rejected") return "rejected";
  return s || "submitted";
}

function parseReason(reason) {
  let code = "other";
  let message = reason || "";
  const m = /^\[([^\]]+)\]\s*(.*)$/s.exec(message);
  if (m) {
    code = m[1];
    message = m[2];
  }
  return { code, message };
}

async function getAppeals() {
  if (!SERVICES.appeal) return [];
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  try {
    const res = await apiFetch(serviceUrl(SERVICES.appeal, ENDPOINTS.appeals), { token });
    if (!res.ok) return [];
    const data = await jsonOrEmpty(res);
    const list = Array.isArray(data) ? data : data.appeals || [];
    return list.map((a) => {
      const { code, message } = parseReason(a.reason);
      return {
        id: `APL-${a.id}`,
        raw_id: a.id,
        order_id: a.order_id,
        employee_id: a.employee_id,
        vendor_id: a.vendor_id,
        reason_code: code,
        message,
        status: mapStatusFromBackend(a.status),
        refund_amount: a.refund_amount,
        admin_notes: a.admin_notes,
        created_at: a.created_at,
      };
    });
  } catch {
    return [];
  }
}

function formatDate(s) {
  if (!s) return "-";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(s));
}

export default async function AdminAppealsPage({ searchParams }) {
  const sp = await searchParams;
  const filter = sp?.status || "";
  const allAppeals = await getAppeals();
  const appeals = filter
    ? allAppeals.filter((a) => a.status === filter)
    : allAppeals;

  const counts = {
    submitted: allAppeals.filter((a) => a.status === "submitted").length,
    resolved: allAppeals.filter((a) => a.status === "resolved").length,
    rejected: allAppeals.filter((a) => a.status === "rejected").length,
  };

  return (
    <div className="space-y-6">
      <section className="surface-panel rounded-lg p-5 sm:p-6">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--admin-coffee-600)]">
          Appeal Management
        </p>
        <h1 className="mt-2 text-3xl font-black text-[var(--admin-coffee-900)]">申訴處理</h1>
        <p className="mt-1 text-sm text-slate-500">處理員工提出的申訴案件，決定核准退款或駁回</p>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-md bg-[var(--warning-bg)] p-3 text-center">
            <p className="text-2xl font-black text-[var(--warning-fg)]">{counts.submitted}</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">待審核</p>
          </div>
          <div className="rounded-md bg-[var(--success-bg)] p-3 text-center">
            <p className="text-2xl font-black text-[var(--success-fg)]">{counts.resolved}</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">已核准</p>
          </div>
          <div className="rounded-md bg-[var(--error-bg)] p-3 text-center">
            <p className="text-2xl font-black text-[var(--error-fg)]">{counts.rejected}</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">已駁回</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            { value: "", label: "全部" },
            { value: "submitted", label: "待審核" },
            { value: "resolved", label: "已核准" },
            { value: "rejected", label: "已駁回" },
          ].map((opt) => {
            const active = (filter || "") === opt.value;
            return (
              <Link
                key={opt.value || "all"}
                href={`/committee/appeals${opt.value ? `?status=${opt.value}` : ""}`}
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

      <section className="surface-panel overflow-hidden rounded-lg">
        {!appeals.length ? (
          <div className="p-8 text-center text-sm text-slate-500">
            目前沒有{filter ? STATUS_META[filter]?.label || "" : ""}申訴
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {appeals.map((a) => {
              const meta = STATUS_META[a.status] || { label: a.status, className: "bg-slate-100 text-slate-600" };
              return (
                <Link
                  key={a.id}
                  href={`/committee/appeals/${a.id}`}
                  className="grid gap-3 p-5 transition hover:bg-[var(--surface-muted)] lg:grid-cols-[1fr_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-black text-[var(--admin-coffee-900)]">{a.id}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}>
                        {meta.label}
                      </span>
                      {a.refund_amount > 0 && (
                        <span className="rounded-full bg-[var(--admin-coffee-100)] px-2.5 py-1 text-xs font-bold text-[var(--admin-coffee-700)]">
                          退款 ${a.refund_amount}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      員工 #{a.employee_id}・訂單 {String(a.order_id).slice(0, 8)}...
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      <span className="font-semibold">{REASON_LABELS[a.reason_code] || a.reason_code}</span>
                      ：{a.message}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-slate-400">
                      送出時間：{formatDate(a.created_at)}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-[var(--admin-coffee-600)]">
                    {a.status === "submitted" ? "立即審核 →" : "查看詳情 →"}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}