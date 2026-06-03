// components/BillingDashboard.js — 福委會帳單儀表板
"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function formatCurrency(n) {
  return "NT$ " + Number(n || 0).toLocaleString();
}

function formatDateTime(s) {
  if (!s) return "—";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  }).format(new Date(s));
}

// 取得「最近 6 個月」清單
function recentMonths() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月`;
    months.push({ value, label });
  }
  return months;
}

export default function BillingDashboard({ statements, vendors }) {
  const router = useRouter();
  const months = useMemo(() => recentMonths(), []);
  const [periodFilter, setPeriodFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  // 篩選
  const filtered = useMemo(() => {
    if (!periodFilter) return statements;
    return statements.filter((s) => (s.statement_period || s.period || "").startsWith(periodFilter));
  }, [statements, periodFilter]);

  // 統計
  const stats = useMemo(() => {
    const totalAmount = filtered.reduce((sum, x) => sum + Number(x.total_amount || 0), 0);
    const totalOrders = filtered.reduce((sum, x) => sum + Number(x.order_count || 0), 0);
    return {
      totalAmount,
      totalOrders,
      count: filtered.length,
    };
  }, [filtered]);

  // 萬能商家對照表：UUID（有/無 dash） + user_id（integer/string）→ 商家名稱
  // 後端 billing 不管回什麼格式都能對應回商家名稱
  const vendorLookup = useMemo(() => {
    const m = {};
    for (const v of vendors) {
      if (v.id) {
        m[v.id] = v.name;                            // 標準 UUID 有 dash
        m[v.id.replace(/-/g, "")] = v.name;          // UUID 沒 dash
      }
      const uid = v.userId ?? v.user_id;
      if (uid !== undefined && uid !== null) {
        m[uid] = v.name;                              // integer user_id
        m[String(uid)] = v.name;                      // string 化的 user_id
      }
    }
    return m;
  }, [vendors]);

  async function deleteStatement(id, label) {
    if (!window.confirm(`確定刪除帳單「${label}」嗎？`)) return;
    try {
      const res = await fetch(`/api/admin/statements/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "刪除失敗");
      router.refresh();
    } catch (err) {
      alert(err.message || "刪除失敗");
    }
  }

  function exportCSV() {
    if (filtered.length === 0) {
      alert("沒有資料可匯出");
      return;
    }
    const header = ["帳單編號", "商家", "結算期間", "訂單筆數", "總金額", "同步時間"];
    const rows = filtered.map((s) => [
      s.id,
      vendorLookup[s.vendor_id] || `未知商家 (${String(s.vendor_id).slice(0, 12)}...)`,
      s.statement_period || s.period || "—",
      Number(s.order_count || 0),
      Number(s.total_amount || 0),
      formatDateTime(s.synced_at || s.created_at),
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    // 加上 BOM，Excel 開啟才不會亂碼
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `billing_${periodFilter || "all"}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <section className="surface-panel rounded-lg p-5 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--admin-coffee-600)]">
              Billing
            </p>
            <h1 className="mt-2 text-3xl font-black text-[var(--admin-coffee-900)]">帳單管理</h1>
            <p className="mt-1 text-sm text-slate-500">建立每月商家結算快照，匯出 CSV 給會計</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportCSV}
              className="min-h-10 rounded-md border border-[var(--admin-coffee-400)] bg-white px-4 text-sm font-bold text-[var(--admin-coffee-700)] transition hover:bg-[var(--admin-coffee-50)]"
            >
              匯出 CSV
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="min-h-10 rounded-md bg-[var(--admin-coffee-600)] px-4 text-sm font-bold text-white transition hover:bg-[var(--admin-coffee-700)]"
            >
              ＋ 建立帳單
            </button>
          </div>
        </div>

        {/* 統計列：總金額 + 帳單數 + 訂單筆數 */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-md bg-[var(--admin-coffee-50)] p-4">
            <p className="text-xs font-semibold text-slate-600">{periodFilter || "全部"}總金額</p>
            <p className="mt-1 text-2xl font-black text-[var(--admin-coffee-700)]">
              {formatCurrency(stats.totalAmount)}
            </p>
          </div>
          <div className="rounded-md bg-[var(--navy-50)] p-4">
            <p className="text-xs font-semibold text-slate-600">帳單數</p>
            <p className="mt-1 text-2xl font-black text-[var(--navy-700)]">{stats.count} 筆</p>
          </div>
          <div className="rounded-md bg-[var(--success-bg)] p-4">
            <p className="text-xs font-semibold text-slate-600">總訂單筆數</p>
            <p className="mt-1 text-2xl font-black text-[var(--success-fg)]">{stats.totalOrders}</p>
          </div>
        </div>

        {/* 月份篩選 */}
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => setPeriodFilter("")}
            className={`rounded-md border px-3 py-1.5 text-sm font-bold transition ${
              !periodFilter
                ? "border-[var(--admin-coffee-600)] bg-[var(--admin-coffee-600)] text-white"
                : "border-[var(--line)] bg-white text-slate-600 hover:border-[var(--admin-coffee-400)]"
            }`}
          >
            全部
          </button>
          {months.map((m) => {
            const active = periodFilter === m.value;
            return (
              <button
                key={m.value}
                onClick={() => setPeriodFilter(m.value)}
                className={`rounded-md border px-3 py-1.5 text-sm font-bold transition ${
                  active
                    ? "border-[var(--admin-coffee-600)] bg-[var(--admin-coffee-600)] text-white"
                    : "border-[var(--line)] bg-white text-slate-600 hover:border-[var(--admin-coffee-400)]"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* 列表 */}
      <section className="surface-panel rounded-lg p-5 sm:p-6">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs font-bold uppercase text-slate-500">
                <th className="py-3 pr-3">帳單編號</th>
                <th className="py-3 pr-3">商家</th>
                <th className="py-3 pr-3">結算期間</th>
                <th className="py-3 pr-3 text-center">訂單筆數</th>
                <th className="py-3 pr-3 text-right">總金額</th>
                <th className="py-3 pr-3">同步時間</th>
                <th className="py-3 pr-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    {periodFilter ? `${periodFilter} 沒有帳單` : "尚未建立任何帳單"}
                  </td>
                </tr>
              ) : filtered.map((s) => {
                const period = s.statement_period || s.period || "—";
                const orderCount = Number(s.order_count || 0);
                const vendorName = vendorLookup[s.vendor_id] || `未知商家 (${String(s.vendor_id).slice(0, 12)}...)`;
                return (
                  <tr key={s.id} className="hover:bg-[var(--surface-muted)]">
                    <td className="py-3 pr-3 font-mono text-xs text-slate-500">#{s.id}</td>
                    <td className="py-3 pr-3 font-semibold text-slate-900">{vendorName}</td>
                    <td className="py-3 pr-3 text-slate-700">{period}</td>
                    <td className="py-3 pr-3 text-center">
                      <span className="inline-block rounded-md bg-[var(--navy-50)] px-2 py-0.5 text-xs font-bold text-[var(--navy-700)]">
                        {orderCount}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-right font-black text-[var(--admin-coffee-700)]">
                      {formatCurrency(s.total_amount)}
                    </td>
                    <td className="py-3 pr-3 text-xs text-slate-500">
                      {formatDateTime(s.synced_at || s.created_at)}
                    </td>
                    <td className="py-3 pr-3 text-right">
                      <button
                        onClick={() => deleteStatement(s.id, `${vendorName} - ${period}`)}
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
        <p className="mt-3 text-xs text-slate-400">共 {filtered.length} 筆帳單</p>
      </section>

      {showCreate && <CreateStatementModal vendors={vendors} onClose={() => setShowCreate(false)} />}
    </div>
  );
}

function CreateStatementModal({ vendors, onClose }) {
  const router = useRouter();
  const months = useMemo(() => recentMonths(), []);
  const [vendorId, setVendorId] = useState(vendors[0]?.id || "");
  const [period, setPeriod] = useState(months[0]?.value || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setResult(null);
    try {
      // 找到選中商家的 userId (integer)，這是 billing 服務需要的
      const vendor = vendors.find((v) => v.id === vendorId);
      const vendorUserId = vendor?.userId ?? vendor?.user_id;
      if (!vendorUserId) {
        throw new Error("這家商家沒有 user_id，無法結算（可能不是經由 IAM 建立的）");
      }

      const res = await fetch("/api/admin/statements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendor_id: vendorUserId,            // 傳 user_id (integer) 給 billing
          statement_period: period,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "建立失敗");
      setResult(data);
      // 1.5 秒後自動關閉並 refresh
      setTimeout(() => {
        onClose();
        router.refresh();
      }, 1500);
    } catch (err) {
      setError(err.message || "建立失敗");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="surface-panel w-full max-w-md rounded-lg p-5 sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <h3 className="text-xl font-black text-[var(--admin-coffee-900)]">建立帳單</h3>
          <button onClick={onClose} className="text-2xl text-slate-400 hover:text-slate-600">×</button>
        </div>

        <p className="mb-4 rounded-md bg-[var(--surface-muted)] p-3 text-xs text-slate-600">
          系統會自動從訂單服務拉取該商家該月份的訂單，計算總金額後寫入帳單。
        </p>

        {error && (
          <div className="mb-4 rounded-md bg-[var(--error-bg)] px-3 py-2 text-sm font-medium text-[var(--error-fg)]">
            {error}
          </div>
        )}

        {result && (
          <div className="mb-4 rounded-md bg-[var(--success-bg)] px-3 py-2 text-sm font-medium text-[var(--success-fg)]">
            ✓ 帳單建立成功！共 {result.order_count} 筆訂單，總金額 NT$ {Number(result.total_amount || 0).toLocaleString()}
          </div>
        )}

        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">商家 *</span>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              required
              className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--admin-coffee-400)]"
            >
              {vendors.length === 0 ? (
                <option value="">（沒有商家）</option>
              ) : (
                vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))
              )}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-semibold text-slate-700">結算期間 *</span>
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              required
              className="w-full rounded-md border border-[var(--line)] bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--admin-coffee-400)]"
            >
              {months.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
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
              disabled={saving || !vendorId || !!result}
              className="flex-1 rounded-md bg-[var(--admin-coffee-600)] py-2.5 text-sm font-bold text-white transition hover:bg-[var(--admin-coffee-700)] disabled:opacity-50"
            >
              {saving ? "計算中..." : result ? "✓ 完成" : "建立"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
