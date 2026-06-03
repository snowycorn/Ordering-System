// app/(admin)/committee/page.js — 福委會總覽
import Link from "next/link";
import { cookies } from "next/headers";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES,
  apiFetch, jsonOrEmpty, serviceUrl,
} from "@/lib/api";

export const dynamic = "force-dynamic";

async function fetchSafe(url, token) {
  if (!url) return null;
  try {
    const res = await apiFetch(url, { token });
    if (!res.ok) return null;
    return await jsonOrEmpty(res);
  } catch {
    return null;
  }
}

async function getDashboardData() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;

  const [usersData, employeesData, vendorsData, appealsData, registrationsData, statementsData] =
    await Promise.all([
      SERVICES.iam ? fetchSafe(serviceUrl(SERVICES.iam, ENDPOINTS.iamUsers), token) : null, // ← 新增
      SERVICES.iam ? fetchSafe(serviceUrl(SERVICES.iam, ENDPOINTS.iamEmployees), token) : null,
      SERVICES.vendor ? fetchSafe(serviceUrl(SERVICES.vendor, ENDPOINTS.vendors), token) : null,
      SERVICES.appeal ? fetchSafe(serviceUrl(SERVICES.appeal, ENDPOINTS.appeals), token) : null,
      SERVICES.vendor ? fetchSafe(`${SERVICES.vendor}/api/v1/admin/register/applications`, token) : null,
      SERVICES.billing ? fetchSafe(serviceUrl(SERVICES.billing, ENDPOINTS.billingStatements), token) : null,
    ]);

  const users = Array.isArray(usersData) ? usersData : usersData?.users || []; // ← 新增
  const employees = Array.isArray(employeesData) ? employeesData : employeesData?.employees || [];
  const vendors = Array.isArray(vendorsData) ? vendorsData : vendorsData?.vendors || [];
  const appeals = Array.isArray(appealsData) ? appealsData : appealsData?.appeals || [];
  const registrations = Array.isArray(registrationsData) ? registrationsData : registrationsData?.applications || [];
  const statements = Array.isArray(statementsData) ? statementsData : statementsData?.statements || [];

  // 用 users 表算（帳號層，比較準）
  const counts = { // ← 新增
    admin: users.filter((u) => u.role === "admin").length,
    employee: users.filter((u) => u.role === "employee").length,
    vendor: users.filter((u) => u.role === "vendor").length,
  };

  const pendingRegistrations = registrations.filter((r) => r.status === "PENDING");
  const pendingAppeals = appeals.filter((a) => a.status === "pending");

  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthlyStatements = statements.filter((s) =>
    (s.period || s.created_at || "").startsWith(thisMonth)
  );
  const monthlyTotal = monthlyStatements.reduce(
    (sum, s) => sum + Number(s.total_amount || 0),
    0
  );

  return {
    users,        // ← 新增
    counts,       // ← 新增
    employees,
    vendors,
    appeals,
    pendingAppeals,
    registrations,
    pendingRegistrations,
    statements,
    monthlyStatements,
    monthlyTotal,
  };
}

function StatCard({ label, value, suffix, href, accent = false }) {
  const Wrapper = href ? Link : "div";
  return (
    <Wrapper
      {...(href ? { href } : {})}
      className={`surface-panel block rounded-lg p-5 transition ${
        href ? "hover:border-[var(--admin-coffee-400)] hover:shadow-md" : ""
      } ${accent ? "border-[var(--admin-coffee-400)] bg-[var(--admin-coffee-50)]" : ""}`}
    >
      <p className="text-sm font-semibold text-slate-600">{label}</p>
      <p className="mt-3 text-3xl font-black text-[var(--admin-coffee-700)]">
        {value}
        {suffix && <span className="ml-1 text-base font-normal text-slate-500">{suffix}</span>}
      </p>
      {href && (
        <p className="mt-2 text-xs font-semibold text-[var(--admin-coffee-600)]">查看詳情 →</p>
      )}
    </Wrapper>
  );
}

function formatCurrency(n) {
  return "NT$ " + Number(n || 0).toLocaleString();
}

export default async function CommitteeHomePage() {
  const d = await getDashboardData();
  const today = new Date();
  const todayLabel = `${today.getFullYear()}/${String(today.getMonth() + 1).padStart(2, "0")}/${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="surface-panel rounded-lg p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--admin-coffee-600)]">
              Committee Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-black text-[var(--admin-coffee-900)]">總覽</h1>
            <p className="mt-1 text-sm text-slate-500">監控帳號、審核入駐、處理申訴與帳本管理</p>
          </div>
          <p className="text-sm text-slate-400">今日 {todayLabel}</p>
        </div>
      </section>

      {/* 五大統計卡 */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
            label="待審核入駐"
            value={d.pendingRegistrations.length}
            suffix="件"
            href="/committee/registrations"
            accent={d.pendingRegistrations.length > 0}
        />
        <StatCard
            label="待處理申訴"
            value={d.pendingAppeals.length}
            suffix="件"
            href="/committee/appeals"
            accent={d.pendingAppeals.length > 0}
        />
        <StatCard
            label="管理員"
            value={d.counts.admin}
            suffix="人"
            href="/committee/accounts"
        />
        <StatCard
            label="員工"
            value={d.counts.employee}
            suffix="人"
            href="/committee/accounts"
        />
        <StatCard
            label="商家"
            value={d.counts.vendor}
            suffix="戶"
            href="/committee/accounts"
        />
        <StatCard
            label="本月帳單"
            value={d.monthlyStatements.length}
            suffix={`筆・${formatCurrency(d.monthlyTotal)}`}
        />
      </section>

      {/* 待處理事項清單 */}
      <section className="surface-panel rounded-lg p-5 sm:p-6">
        <h2 className="text-lg font-black text-[var(--admin-coffee-900)]">待處理事項</h2>
        {d.pendingRegistrations.length === 0 && d.pendingAppeals.length === 0 ? (
          <p className="mt-4 rounded-md bg-[var(--surface-muted)] p-4 text-center text-sm text-slate-500">
            目前沒有待處理事項，可以休息一下
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {d.pendingRegistrations.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">
                    入駐申請：{r.vendorName || r.vendor_name || "未命名商家"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    申請 email：{r.email}・{new Date(r.createdAt || r.created_at).toLocaleString("zh-TW")}
                  </p>
                </div>
                <Link
                  href="/committee/registrations"
                  className="shrink-0 rounded-md bg-[var(--admin-coffee-600)] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[var(--admin-coffee-700)]"
                >
                  立即審核
                </Link>
              </li>
            ))}
            {d.pendingAppeals.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-3">
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">
                    申訴 APL-{a.id}：{a.reason}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    員工 ID {a.employee_id}・{new Date(a.created_at).toLocaleString("zh-TW")}
                  </p>
                </div>
                <Link
                  href="/committee/appeals"
                  className="shrink-0 rounded-md bg-[var(--admin-coffee-600)] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[var(--admin-coffee-700)]"
                >
                  立即處理
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 工作區捷徑 */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Link
            href="/committee/accounts"
            className="surface-panel rounded-lg p-5 transition hover:border-[var(--admin-coffee-400)] hover:shadow-md"
        >
            <p className="font-bold text-[var(--admin-coffee-900)]">帳號管理</p>
            <p className="mt-1 text-xs text-slate-500">員工、商家、管理員一覽</p>
        </Link>
        <Link
            href="/committee/vendors"
            className="surface-panel rounded-lg p-5 transition hover:border-[var(--admin-coffee-400)] hover:shadow-md"
        >
            <p className="font-bold text-[var(--admin-coffee-900)]">商家管理</p>
            <p className="mt-1 text-xs text-slate-500">調整狀態、登記違規</p>
        </Link>
        <Link
            href="/committee/registrations"
            className="surface-panel rounded-lg p-5 transition hover:border-[var(--admin-coffee-400)] hover:shadow-md"
        >
            <p className="font-bold text-[var(--admin-coffee-900)]">入駐審核</p>
            <p className="mt-1 text-xs text-slate-500">審核新商家申請</p>
        </Link>
        <Link
            href="/committee/appeals"
            className="surface-panel rounded-lg p-5 transition hover:border-[var(--admin-coffee-400)] hover:shadow-md"
        >
            <p className="font-bold text-[var(--admin-coffee-900)]">申訴處理</p>
            <p className="mt-1 text-xs text-slate-500">處理員工申訴、決定退款</p>
        </Link>
        <Link
            href="/committee/billing"
            className="surface-panel rounded-lg p-5 transition hover:border-[var(--admin-coffee-400)] hover:shadow-md"
        >
            <p className="font-bold text-[var(--admin-coffee-900)]">帳單管理</p>
            <p className="mt-1 text-xs text-slate-500">月報表、商家結算</p>
        </Link>
      </section>
    </div>
  );
}