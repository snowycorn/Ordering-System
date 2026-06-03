// components/VendorManagementTable.js — 商家管理互動表格
"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_META = {
  ACTIVE: { label: "營運中", className: "bg-[var(--success-bg)] text-[var(--success-fg)]" },
  SUSPENDED: { label: "已停權", className: "bg-[var(--error-bg)] text-[var(--error-fg)]" },
};

const ZONE_OPTIONS = ["A廠", "B廠", "C廠"];

export default function VendorManagementTable({ vendors }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL / ACTIVE / SUSPENDED
  const [suspendingFor, setSuspendingFor] = useState(null);
  const [zoneEditingFor, setZoneEditingFor] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const filtered = useMemo(() => {
    return vendors.filter((v) => {
      // 狀態篩選
      if (statusFilter !== "ALL" && v.status !== statusFilter) return false;
      // 廠區篩選
      if (zoneFilter && !(v.factoryZones || []).includes(zoneFilter)) return false;
      // 文字搜尋
      if (query) {
        const kw = query.toLowerCase();
        if (
          !v.name.toLowerCase().includes(kw) &&
          !(v.category || "").toLowerCase().includes(kw)
        ) return false;
      }
      return true;
    });
  }, [vendors, query, zoneFilter, statusFilter]);

  async function reactivate(vendor) {
    if (!window.confirm(`確定要恢復「${vendor.name}」的營運嗎？\n恢復後員工可再次訂購此商家的餐點。`)) return;

    setBusyId(vendor.id);
    try {
      const res = await fetch(`/api/admin/vendors/${vendor.id}?action=reactivate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "復權失敗");
      router.refresh();
    } catch (err) {
      alert(err.message || "復權失敗");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="surface-panel rounded-lg p-5 sm:p-6">
      {/* 搜尋 + 篩選 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜尋商家名稱或分類"
          className="min-h-10 flex-1 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--admin-coffee-400)] sm:max-w-xs"
        />
        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="min-h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--admin-coffee-400)]"
        >
          <option value="">全部廠區</option>
          {ZONE_OPTIONS.map((z) => (
            <option key={z} value={z}>{z}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="min-h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--admin-coffee-400)]"
        >
          <option value="ALL">全部狀態</option>
          <option value="ACTIVE">營運中</option>
          <option value="SUSPENDED">已停權</option>
        </select>
      </div>

      {/* 表格 */}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase text-slate-500">
              <th className="py-3 pr-3">商家名稱</th>
              <th className="py-3 pr-3">分類</th>
              <th className="py-3 pr-3">服務廠區</th>
              <th className="py-3 pr-3 text-center">違規</th>
              <th className="py-3 pr-3">狀態</th>
              <th className="py-3 pr-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-12 text-center text-slate-400">
                  沒有符合條件的商家
                </td>
              </tr>
            ) : filtered.map((v) => {
              const meta = STATUS_META[v.status] || { label: v.status || "未知", className: "bg-slate-100 text-slate-600" };
              const isActive = v.status === "ACTIVE";
              const isSuspended = v.status === "SUSPENDED";
              const zones = v.factoryZones || [];
              const violations = Number(v.violationPoints || 0);
              return (
                <tr
                  key={v.id}
                  className={`transition ${
                    isSuspended
                      ? "bg-slate-50 opacity-60 hover:opacity-80"
                      : "hover:bg-[var(--surface-muted)]"
                  }`}
                >
                  <td className="py-3 pr-3">
                    <p className={`font-bold ${isSuspended ? "text-slate-500 line-through" : "text-slate-900"}`}>
                      {v.name}
                    </p>
                    <p className="text-xs text-slate-400">{String(v.id).slice(0, 8)}...</p>
                  </td>
                  <td className="py-3 pr-3 text-slate-700">{v.category || "—"}</td>
                  <td className="py-3 pr-3">
                    {zones.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {zones.map((z) => (
                          <span
                            key={z}
                            className="rounded-full bg-[var(--admin-coffee-50)] px-2 py-0.5 text-xs font-semibold text-[var(--admin-coffee-700)]"
                          >
                            {z}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-center">
                    <span className={`inline-block min-w-[2.5rem] rounded-md px-2 py-0.5 text-sm font-black ${
                      violations === 0
                        ? "bg-slate-100 text-slate-500"
                        : violations < 3
                          ? "bg-[var(--warning-bg)] text-[var(--warning-fg)]"
                          : "bg-[var(--error-bg)] text-[var(--error-fg)]"
                    }`}>
                      {violations}
                    </span>
                  </td>
                  <td className="py-3 pr-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${meta.className}`}>
                      {meta.label}
                    </span>
                    {isSuspended && v.suspendReason && (
                      <p className="mt-1 text-xs text-slate-400" title={v.suspendReason}>
                        原因：{String(v.suspendReason).slice(0, 15)}{v.suspendReason.length > 15 ? "..." : ""}
                      </p>
                    )}
                  </td>
                  <td className="py-3 pr-3 text-right">
                    <div className="inline-flex gap-2">
                      <button
                        onClick={() => setZoneEditingFor(v)}
                        className="rounded-md border border-[var(--line)] px-3 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                      >
                        修改廠區
                      </button>
                      {isActive ? (
                        <button
                          onClick={() => setSuspendingFor(v)}
                          disabled={busyId === v.id}
                          className="rounded-md border border-[var(--error-fg)]/30 px-3 py-1 text-xs font-bold text-[var(--error-fg)] transition hover:bg-[var(--error-fg)] hover:text-white disabled:opacity-50"
                        >
                          停權
                        </button>
                      ) : (
                        <button
                          onClick={() => reactivate(v)}
                          disabled={busyId === v.id}
                          className="rounded-md border border-[var(--success-fg)]/30 px-3 py-1 text-xs font-bold text-[var(--success-fg)] transition hover:bg-[var(--success-fg)] hover:text-white disabled:opacity-50"
                        >
                          {busyId === v.id ? "..." : "復權"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-slate-400">
        共 {filtered.length} 戶商家・違規點數會在福委會核准申訴退款時自動 +1
      </p>

      {/* 停權彈窗 */}
      {suspendingFor && (
        <SuspendModal vendor={suspendingFor} onClose={() => setSuspendingFor(null)} />
      )}

      {/* 修改廠區彈窗 */}
      {zoneEditingFor && (
        <ZoneEditModal vendor={zoneEditingFor} onClose={() => setZoneEditingFor(null)} />
      )}
    </section>
  );
}

function SuspendModal({ vendor, onClose }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e) {
    e.preventDefault();
    if (!reason.trim()) {
      setError("請填寫停權原因");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/vendors/${vendor.id}?action=suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "停權失敗");
      onClose();
      router.refresh();
    } catch (err) {
      setError(err.message || "停權失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="surface-panel w-full max-w-md rounded-lg p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-black text-[var(--admin-coffee-900)]">停權商家</h3>
          <button onClick={onClose} className="text-2xl text-slate-400 hover:text-slate-600">×</button>
        </div>

        <div className="mb-4 rounded-md bg-[var(--surface-muted)] p-3">
          <p className="text-xs text-slate-500">商家</p>
          <p className="font-bold text-slate-900">{vendor.name}</p>
        </div>

        <div className="mb-4 rounded-md bg-[var(--warning-bg)] p-3 text-xs text-[var(--warning-fg)]">
          停權後此商家立即從員工點餐畫面消失，已開放預購視窗的庫存也會清零
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-fg)]">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">停權原因 *</span>
            <textarea
              rows="3"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              placeholder="範例：違規累計達上限、衛生檢查未通過、申訴案件頻繁"
              className="w-full resize-none rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--admin-coffee-400)]"
            />
          </label>

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
              className="flex-1 rounded-md bg-[var(--error-fg)] py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "處理中..." : "確認停權"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ZoneEditModal({ vendor, onClose }) {
  const router = useRouter();
  const [zones, setZones] = useState(vendor.factoryZones || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function toggleZone(z) {
    setZones((prev) =>
      prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z]
    );
  }

  async function submit(e) {
    e.preventDefault();
    if (zones.length === 0) {
      setError("至少要選一個廠區");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/vendors/${vendor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: vendor.name,
          category: vendor.category,
          description: vendor.description,
          factoryZones: zones,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "更新失敗");
      onClose();
      router.refresh();
    } catch (err) {
      setError(err.message || "更新失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="surface-panel w-full max-w-md rounded-lg p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-black text-[var(--admin-coffee-900)]">修改服務廠區</h3>
          <button onClick={onClose} className="text-2xl text-slate-400 hover:text-slate-600">×</button>
        </div>

        <div className="mb-4 rounded-md bg-[var(--surface-muted)] p-3">
          <p className="text-xs text-slate-500">商家</p>
          <p className="font-bold text-slate-900">{vendor.name}</p>
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-fg)]">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">勾選此商家可服務的廠區（可多選）</p>
            <div className="space-y-2">
              {ZONE_OPTIONS.map((z) => {
                const checked = zones.includes(z);
                return (
                  <label
                    key={z}
                    className={`flex items-center gap-3 rounded-md border p-3 cursor-pointer transition ${
                      checked
                        ? "border-[var(--admin-coffee-400)] bg-[var(--admin-coffee-50)]"
                        : "border-[var(--line)] bg-white hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleZone(z)}
                      className="h-4 w-4"
                    />
                    <span className="font-semibold text-slate-900">{z}</span>
                  </label>
                );
              })}
            </div>
          </div>

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
              {saving ? "儲存中..." : "確認"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}