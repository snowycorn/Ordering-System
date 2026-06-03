// app/(admin)/committee/accounts/page.js — 福委會帳號管理
import { cookies } from "next/headers";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES,
  apiFetch, jsonOrEmpty, serviceUrl,
} from "@/lib/api";
import AccountsTable from "@/components/AccountsTable";

export const dynamic = "force-dynamic";

async function getAccounts() {
  if (!SERVICES.iam) return [];
  const token = (await cookies()).get(COOKIE_NAME)?.value;

  try {
    const [usersRes, employeesRes] = await Promise.all([
      apiFetch(serviceUrl(SERVICES.iam, ENDPOINTS.iamUsers), { token }),
      apiFetch(serviceUrl(SERVICES.iam, ENDPOINTS.iamEmployees), { token }),
    ]);

    if (!usersRes.ok) return [];
    const users = await jsonOrEmpty(usersRes);
    const usersList = Array.isArray(users) ? users : users.users || [];

    let employeesList = [];
    if (employeesRes.ok) {
      const employees = await jsonOrEmpty(employeesRes);
      employeesList = Array.isArray(employees) ? employees : employees.employees || [];
    }

    const employeeByUserId = {};
    for (const e of employeesList) employeeByUserId[e.user_id] = e;

    return usersList.map((u) => {
      const emp = employeeByUserId[u.id];
      return {
        id: u.id,
        email: u.email,
        role: u.role,
        created_at: u.created_at,
        last_login_at: u.last_login_at,
        full_name: emp?.full_name || null,
        factory_zone: emp?.factory_zone || null,
        phone_number: emp?.phone_number || null,
      };
    });
  } catch {
    return [];
  }
}

export default async function AccountsPage() {
  const accounts = await getAccounts();

  const stats = {
    admin: accounts.filter((a) => a.role === "admin").length,
    employee: accounts.filter((a) => a.role === "employee").length,
    vendor: accounts.filter((a) => a.role === "vendor").length,
  };

  return (
    <div className="space-y-6">
      <section className="surface-panel rounded-lg p-5 sm:p-6">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--admin-coffee-600)]">
          Account Management
        </p>
        <h1 className="mt-2 text-3xl font-black text-[var(--admin-coffee-900)]">帳號管理</h1>
        <p className="mt-1 text-sm text-slate-500">監控所有帳號狀態，建立新員工或刪除無效帳號</p>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <div className="rounded-md bg-[var(--admin-coffee-50)] p-3 text-center">
            <p className="text-2xl font-black text-[var(--admin-coffee-700)]">{stats.admin}</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">管理員</p>
          </div>
          <div className="rounded-md bg-[var(--success-bg)] p-3 text-center">
            <p className="text-2xl font-black text-[var(--success-fg)]">{stats.employee}</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">員工</p>
          </div>
          <div className="rounded-md bg-[var(--warning-bg)] p-3 text-center">
            <p className="text-2xl font-black text-[var(--warning-fg)]">{stats.vendor}</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">商家</p>
          </div>
        </div>
      </section>

      <AccountsTable accounts={accounts} />
    </div>
  );
}