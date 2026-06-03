// components/AccountsTable.js — 福委會帳號列表（含搜尋、篩選、新增、刪除）
"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

const ROLE_META = {
  admin: { label: "管理員", className: "bg-[var(--admin-coffee-100)] text-[var(--admin-coffee-700)]" },
  employee: { label: "員工", className: "bg-[var(--success-bg)] text-[var(--success-fg)]" },
  vendor: { label: "商家", className: "bg-[var(--warning-bg)] text-[var(--warning-fg)]" },
};

function formatDate(s) {
  if (!s) return "—";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit"
  }).format(new Date(s));
}

export default function AccountsTable({ accounts }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    return accounts.filter((a) => {
      if (roleFilter && a.role !== roleFilter) return false;
      if (query) {
        const kw = query.toLowerCase();
        if (
          !a.email.toLowerCase().includes(kw) &&
          !(a.full_name || "").toLowerCase().includes(kw) &&
          !(a.factory_zone || "").toLowerCase().includes(kw)
        ) return false;
      }
      return true;
    });
  }, [accounts, query, roleFilter]);

  async function deleteAccount(id, email) {
    if (!window.confirm(`確定刪除「${email}」這個帳號嗎？\n此操作無法復原。`)) return;
    try {
      const res = await fetch(`/api/admin/accounts/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "刪除失敗");
      router.refresh();
    } catch (err) {
      alert(err.message || "刪除失敗");
    }
  }

  return (
    <section className="surface-panel rounded-lg p-5 sm:p-6">
      {/* 工具列 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋 email、姓名、廠區"
            className="min-h-10 flex-1 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--admin-coffee-400)] sm:max-w-xs"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="min-h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--admin-coffee-400)]"
          >
            <option value="">全部角色</option>
            <option value="admin">管理員</option>
            <option value="employee">員工</option>
            <option value="vendor">商家</option>
          </select>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="min-h-10 shrink-0 rounded-md bg-[var(--admin-coffee-600)] px-5 text-sm font-bold text-white transition hover:bg-[var(--admin-coffee-700)]"
        >
          ＋ 新增帳號
        </button>
      </div>

      {/* 列表 */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase text-slate-500">
                <th className="py-3 pr-3">ID</th>
                <th className="py-3 pr-3">Email</th>
                <th className="py-3 pr-3">角色</th>
                <th className="py-3 pr-3">姓名</th>
                <th className="py-3 pr-3">廠區 <span className="font-normal text-slate-400">(員工)</span></th>
                <th className="py-3 pr-3">建立日期</th>
                <th className="py-3 pr-3">最後登入</th>
                <th className="py-3 pr-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="8" className="py-12 text-center text-slate-400">
                  沒有符合條件的帳號
                </td>
              </tr>
            ) : filtered.map((a) => {
              const roleMeta = ROLE_META[a.role] || { label: a.role, className: "bg-slate-100 text-slate-600" };
              return (
                <tr key={a.id} className="hover:bg-[var(--surface-muted)]">
                  <td className="py-3 pr-3 font-mono text-xs text-slate-500">#{a.id}</td>
                  <td className="py-3 pr-3 font-semibold text-slate-900">{a.email}</td>
                  <td className="py-3 pr-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${roleMeta.className}`}>
                      {roleMeta.label}
                    </span>
                  </td>
                  <td className="py-3 pr-3 text-slate-700">{a.full_name || "—"}</td>
                  <td className="py-3 pr-3 text-slate-700">{a.factory_zone || "—"}</td>
                  <td className="py-3 pr-3 text-slate-500">{formatDate(a.created_at)}</td>
                  <td className="py-3 pr-3 text-slate-500">{formatDate(a.last_login_at)}</td>
                  <td className="py-3 pr-3 text-right">
                    <button
                      onClick={() => deleteAccount(a.id, a.email)}
                      className="rounded-md border border-[var(--error-fg)]/30 px-3 py-1 text-xs font-bold text-[var(--error-fg)] transition hover:bg-[var(--error-fg)] hover:text-white"
                    >
                      刪除
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-400">共 {filtered.length} 筆帳號</p>

      {/* 新增帳號彈窗 */}
      {showCreate && <CreateAccountModal onClose={() => setShowCreate(false)} />}
    </section>
  );
}

function CreateAccountModal({ onClose }) {
  const router = useRouter();
  const [form, setForm] = useState({
    email: "",
    password: "",
    role: "employee",
    full_name: "",
    factory_zone: "A廠",
    phone_number: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "建立失敗");
      onClose();
      router.refresh();
    } catch (err) {
      setError(err.message || "建立失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="surface-panel w-full max-w-lg rounded-lg p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-black text-[var(--admin-coffee-900)]">新增帳號</h3>
          <button onClick={onClose} className="text-2xl text-slate-400 hover:text-slate-600">×</button>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm font-medium text-[var(--error-fg)]">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">角色 *</span>
            <select
              value={form.role}
              onChange={(e) => update("role", e.target.value)}
              required
              className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--admin-coffee-400)]"
            >
              <option value="employee">員工</option>
              <option value="vendor">商家</option>
              <option value="admin">管理員</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">Email *</span>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="name@example.com"
              className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--admin-coffee-400)]"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">密碼 *</span>
            <input
              type="text"
              required
              minLength={4}
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder="至少 4 字元"
              className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--admin-coffee-400)]"
            />
          </label>

          {form.role === "employee" && (
            <>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">姓名</span>
                <input
                  value={form.full_name}
                  onChange={(e) => update("full_name", e.target.value)}
                  placeholder="王小明"
                  className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--admin-coffee-400)]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">廠區</span>
                <select
                  value={form.factory_zone}
                  onChange={(e) => update("factory_zone", e.target.value)}
                  className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--admin-coffee-400)]"
                >
                  <option value="A廠">A 廠</option>
                  <option value="B廠">B 廠</option>
                  <option value="C廠">C 廠</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700">電話</span>
                <input
                  value={form.phone_number}
                  onChange={(e) => update("phone_number", e.target.value)}
                  placeholder="0912345678"
                  className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--admin-coffee-400)]"
                />
              </label>
            </>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-md border border-[var(--line)] bg-white py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-md bg-[var(--admin-coffee-600)] py-2.5 text-sm font-bold text-white transition hover:bg-[var(--admin-coffee-700)] disabled:opacity-50"
            >
              {saving ? "建立中..." : "建立帳號"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}