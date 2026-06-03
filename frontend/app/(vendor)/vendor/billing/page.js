// app/(vendor)/vendor/billing/page.js
import { cookies } from "next/headers";
import Link from "next/link";
import { COOKIE_NAME, SERVICES, ENDPOINTS, apiFetch, jsonOrEmpty, serviceUrl, withPathParams, parseJwt } from "@/lib/api";

async function getBillingData() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return [];

  const { userId } = parseJwt(token);
  if (!userId) return [];

  try {
    const sUrl = serviceUrl(SERVICES.billing, withPathParams(ENDPOINTS.billingStatementsByUser, { id: userId }));
    const res = await apiFetch(sUrl, { token });
    const data = await jsonOrEmpty(res);
    return Array.isArray(data) ? data : data.statements || [];
  } catch {
    return [];
  }
}

export default async function VendorBillingPage() {
  const statements = await getBillingData();

  return (
    <div className="w-full space-y-6">
      {/* 標題區 */}
      <section className="surface-panel rounded-lg px-4 py-5 sm:px-6 lg:px-7">
        <Link href="/vendor" className="text-xs font-semibold text-[var(--teal-600)] hover:underline">
          ← 返回工作台
        </Link>
        <div className="mt-3">
          <h1 className="text-3xl font-black text-[var(--navy-900)]">財務與對帳管理</h1>
          <p className="mt-1 text-sm text-slate-500">查看您的歷史營收帳單與平台違規紀錄</p>
        </div>
      </section>

      {/* 帳單模組 */}
      <section className="surface-panel rounded-lg p-5">
        <h2 className="mb-4 text-lg font-black text-[var(--navy-900)]">本月收益對帳單</h2>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-[var(--navy-50)] text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-5 py-3">帳單編號</th>
                <th className="px-5 py-3">結算月份</th>
                <th className="px-5 py-3">月收益</th>
                <th className="px-5 py-3">最後同步時間</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {statements.map((s) => (
                <tr key={s.id} className="hover:bg-[var(--surface-muted)]">
                  <td className="px-5 py-4 font-semibold text-[var(--navy-900)]">#STMT-{s.id}</td>
                  <td className="px-5 py-4 text-slate-600">{s.statement_period || "—"}</td>
                  <td className="px-5 py-4 font-bold text-[var(--navy-600)]">${Number(s.total_amount ?? 0).toLocaleString()}</td>
                  <td className="px-5 py-4 text-slate-500 text-xs">{s.synced_at ? new Date(s.synced_at).toLocaleString("zh-TW") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!statements.length && (
            <div className="p-8 text-center text-sm text-slate-500">目前尚無歷史對帳單。</div>
          )}
        </div>
      </section>

    </div>
  );
}