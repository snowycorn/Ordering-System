// app/(admin)/committee/vendors/page.js — 福委會商家管理
import { cookies } from "next/headers";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES,
  apiFetch, jsonOrEmpty, serviceUrl,
} from "@/lib/api";
import VendorManagementTable from "@/components/VendorManagementTable";

export const dynamic = "force-dynamic";

async function getVendors() {
  if (!SERVICES.vendor) return [];
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  try {
    // 改用 admin endpoint，會回所有商家（含 SUSPENDED）
    const res = await apiFetch(`${SERVICES.vendor}/api/v1/admin/vendors`, { token });
    if (!res.ok) return [];
    const data = await jsonOrEmpty(res);
    return Array.isArray(data) ? data : data.vendors || [];
  } catch {
    return [];
  }
}

export default async function VendorsManagementPage() {
  const vendors = await getVendors();

  const stats = {
    active: vendors.filter((v) => v.status === "ACTIVE").length,
    suspended: vendors.filter((v) => v.status === "SUSPENDED").length,
    total: vendors.length,
  };

  return (
    <div className="space-y-6">
      <section className="surface-panel rounded-lg p-5 sm:p-6">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--admin-coffee-600)]">
          Vendor Management
        </p>
        <h1 className="mt-2 text-3xl font-black text-[var(--admin-coffee-900)]">商家管理</h1>
        <p className="mt-1 text-sm text-slate-500">管理已入駐商家、調整狀態、登記違規紀錄</p>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-md bg-[var(--success-bg)] p-3 text-center">
            <p className="text-2xl font-black text-[var(--success-fg)]">{stats.active}</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">營運中</p>
          </div>
          <div className="rounded-md bg-[var(--error-bg)] p-3 text-center">
            <p className="text-2xl font-black text-[var(--error-fg)]">{stats.suspended}</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">已停權</p>
          </div>
          <div className="rounded-md bg-[var(--admin-coffee-50)] p-3 text-center">
            <p className="text-2xl font-black text-[var(--admin-coffee-700)]">{stats.total}</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">總計</p>
          </div>
        </div>
      </section>

      <VendorManagementTable vendors={vendors} />
    </div>
  );
}