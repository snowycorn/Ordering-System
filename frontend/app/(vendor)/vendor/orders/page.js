// app/(vendor)/vendor/orders/page.js
import Link from "next/link";
import { cookies } from "next/headers";
import {
  COOKIE_NAME,
  ENDPOINTS,
  SERVICES,
  USE_LOCAL_MOCKS,
  apiFetch,
  jsonOrEmpty,
  serviceUrl,
} from "@/lib/api";
import { MOCK_ORDERS } from "@/lib/mockData";

const STATUS_META = {
  pending:   { label: "待確認", className: "bg-yellow-50 text-yellow-600" },
  confirmed: { label: "已確認", className: "bg-[var(--navy-50)] text-[var(--navy-600)]" },
  completed: { label: "已完成", className: "bg-slate-100 text-slate-600" },
  cancelled: { label: "已取消", className: "bg-[var(--error-bg)] text-[var(--error-fg)]" },
};

// 輔助函式：將前端的 range (today, upcoming, history) 轉換成後端需要的 from 和 to 日期格式
function calculateDates(rangeParam, fromParam, toParam) {
  // 如果 URL 已經帶有明確的 from/to，優先使用
  if (fromParam && toParam) {
    return { from: fromParam, to: toParam };
  }

  const today = new Date();
  const tzOffset = today.getTimezoneOffset() * 60000; // 處理時區
  const localISODate = (date) => new Date(date.getTime() - tzOffset).toISOString().split("T")[0];

  if (rangeParam === "today") {
    const dateStr = localISODate(today);
    return { from: dateStr, to: dateStr };
  }

  if (rangeParam === "upcoming") {
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);
    return { from: localISODate(today), to: localISODate(nextWeek) };
  }

  if (rangeParam === "history") {
    const past = new Date();
    past.setMonth(today.getMonth() - 3); // 預設拉過去 3 個月的歷史紀錄
    return { from: localISODate(past), to: localISODate(today) };
  }

  return { from: "", to: "" };
}

async function getOrders(rangeParam, fromParam, toParam) {
  if (USE_LOCAL_MOCKS) {
    console.warn("Using local mock orders data. To fetch from backend, set USE_LOCAL_MOCKS=false in environment variables.");
    return MOCK_ORDERS;
  }

  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!SERVICES.order || !token) return MOCK_ORDERS;

  try {
    const vendorId = (await cookies()).get("userId")?.value;
    console.log("Resolved vendor ID:", vendorId);
    if (!vendorId) {
      console.error("getOrders: could not resolve vendor ID");
      return MOCK_ORDERS;
    }

    const basePath = `/vendor/orders/vendor/${vendorId}`;
    const base = serviceUrl(SERVICES.order, basePath);

    const { from, to } = calculateDates(rangeParam, fromParam, toParam);
    const qs = new URLSearchParams();
    if (from) qs.set("from", from);
    if (to)   qs.set("to", to);
    
    const url = qs.size ? `${base}?${qs.toString()}` : base;

    console.log("Sending request to backend URL:", url);

    const res = await apiFetch(url, { token });
    if (!res.ok) {
      console.error(`Backend error: ${res.status}`);
      return MOCK_ORDERS;
    }

    const data = await jsonOrEmpty(res);
    const list = Array.isArray(data) ? data : data.orders ?? [];

    console.log("Backend response:", JSON.stringify(list[0], null, 2));

    return list.map((o) => {
      const price = Number(o.price ?? o.price_snapshot ?? 0);
      const qty   = Number(o.quantity ?? 1);
      return {
        id:            String(o.id).startsWith("ORD-") ? o.id : `ORD-${o.id}`,
        raw_id:        o.raw_id ?? o.id,
        employee_name: o.employee_name ?? o.user_name ?? (o.user_id ? `員工 #${o.user_id}` : "未知員工"),
        menu_name:     o.menu_name ?? o.items?.[0]?.name ?? "未知餐點",
        factory_zone:  o.factoryZone ?? o.factory_zone ?? "未知廠區",
        status:        o.status ?? "pending",
        order_date:    (o.order_date ?? o.created_at)?.slice(0, 10) ?? null,
        pickup_date:   o.pickup_date ?? o.target_date ?? null,
        quantity:      qty,
        price,
        total_amount:  Number(o.total_amount ?? o.total_price ?? price * qty),
        cancel_reason: o.cancel_reason ?? "",
      };
    });
  } catch (error) {
    console.error("取得訂單時發生嚴重例外錯誤:", error);
    return MOCK_ORDERS;
  }
}

function buildPrepSummary(orders) {
  const today = new Date();
  const tzOffset = today.getTimezoneOffset() * 60000;
  const localToday = new Date(today.getTime() - tzOffset).toISOString().split("T")[0];

  const map = {};
  for (const o of orders) {
    if (o.status === "cancelled") continue;
    const date = o.pickup_date;
    if (!date || date < localToday) continue;
    if (!map[date]) map[date] = {};
    map[date][o.menu_name] = (map[date][o.menu_name] ?? 0) + o.quantity;
  }

  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, items]) => ({
      date,
      items: Object.entries(items)
        .sort(([, a], [, b]) => b - a)
        .map(([name, qty]) => ({ name, qty })),
    }));
}

function statusMeta(status) {
  return STATUS_META[status] ?? { label: status ?? "未知", className: "bg-slate-100 text-slate-600" };
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("zh-TW", { month: "2-digit", day: "2-digit", weekday: "short" }).format(d);
}

export default async function VendorOrdersPage({ searchParams }) {
  const params    = await searchParams;
  const status    = params?.status ?? "all";
  const range     = params?.range  ?? "upcoming";
  const fromParam = params?.from   ?? "";
  const toParam   = params?.to     ?? "";

  const orders   = await getOrders(range, fromParam, toParam);
  console.log("Fetched orders:", orders);
  const filtered    = status === "all" ? orders : orders.filter((o) => o.status === status);
  const prepSummary = buildPrepSummary(orders);

  const counts = {
    all:       orders.length,
    active:    orders.filter((o) => !["completed", "cancelled"].includes(o.status)).length,
    completed: orders.filter((o) => o.status === "completed").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      {/* 標題 */}
      <section className="surface-panel rounded-lg px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/vendor" className="text-xs font-semibold text-[var(--teal-600)] hover:underline">
          ← 返回工作台
        </Link>
        <p className="mt-3 text-sm font-bold uppercase tracking-[0.18em] text-[var(--teal-600)]">Order Management</p>
        <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black text-[var(--navy-900)]">所有訂單</h1>
            <p className="mt-2 text-sm text-slate-600">查看員工的訂餐紀錄，點進明細可查看完整資訊。</p>
          </div>
          <form className="flex flex-wrap gap-2">
            <select
              name="range"
              defaultValue={range}
              className="min-h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--teal-400)] focus:ring-2 focus:ring-[var(--teal-200)]/50"
            >
              <option value="today">今天</option>
              <option value="upcoming">即將到來</option>
              <option value="history">歷史</option>
            </select>
            <select
              name="status"
              defaultValue={status}
              className="min-h-10 rounded-md border border-[var(--line)] bg-white px-3 text-sm outline-none focus:border-[var(--teal-400)] focus:ring-2 focus:ring-[var(--teal-200)]/50"
            >
              <option value="all">全部狀態</option>
              <option value="pending">待確認</option>
              <option value="confirmed">已確認</option>
              <option value="completed">已完成</option>
              <option value="cancelled">已取消</option>
            </select>
            <button className="rounded-md bg-[var(--navy-600)] px-4 text-sm font-bold text-white hover:bg-[var(--navy-800)]">篩選</button>
          </form>
        </div>
      </section>

      {/* 統計卡片 */}
      <section className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "全部",   value: counts.all,       color: "border-[var(--navy-600)] bg-[var(--navy-50)] text-[var(--navy-600)]" },
          { label: "進行中", value: counts.active,    color: "border-yellow-400 bg-yellow-50 text-yellow-600" },
          { label: "已完成", value: counts.completed, color: "border-[var(--teal-400)] bg-[var(--teal-50)] text-[var(--teal-600)]" },
          { label: "已取消", value: counts.cancelled, color: "border-red-300 bg-red-50 text-red-500" },
        ].map((s) => (
          <div key={s.label} className={`rounded-lg border-l-4 p-4 ${s.color}`}>
            <p className="text-sm font-bold">{s.label}</p>
            <p className="mt-1 text-2xl font-black">{s.value}</p>
          </div>
        ))}
      </section>

      {/* 本週備餐總覽 */}
      {prepSummary.length > 0 && (
        <section className="surface-panel rounded-lg p-5">
          <h2 className="mb-4 text-lg font-black text-[var(--navy-900)]">備餐總覽</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {prepSummary.map(({ date, items }) => {
              const total = items.reduce((s, i) => s + i.qty, 0);
              return (
                <div key={date} className="rounded-md border border-[var(--line)] bg-slate-50 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-[var(--navy-900)]">{date}</p>
                  </div>
                  <ul className="space-y-1">
                    {items.map(({ name, qty }) => (
                      <li key={name} className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate text-slate-600">{name}</span>
                        <span className="shrink-0 font-bold text-[var(--teal-600)]">{qty}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 訂單列表 */}
      <section className="surface-panel overflow-hidden rounded-lg">
        {/* 桌機表格 */}
        <div className="hidden overflow-x-auto lg:block">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-[var(--navy-50)] text-xs font-bold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3">訂單編號</th>
                <th className="px-5 py-3">訂餐員工</th>
                <th className="px-5 py-3">廠區</th>
                <th className="px-5 py-3">金額</th>
                <th className="px-5 py-3">訂餐時間</th>
                <th className="px-5 py-3">取餐日期</th>
                <th className="px-5 py-3">狀態</th>
                <th className="px-5 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((order) => {
                const meta = statusMeta(order.status);
                return (
                  <tr key={order.id} className="hover:bg-[var(--surface-muted)]">
                    <td className="px-5 py-4 font-semibold text-[var(--navy-900)]">{order.id}</td>
                    <td className="px-5 py-4 text-slate-600">{order.employee_name}</td>
                    <td className="px-5 py-4 text-slate-600">{order.factory_zone}</td>
                    <td className="px-5 py-4 font-bold text-[var(--navy-600)]">${(order.total_amount || 0).toLocaleString()}</td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(order.order_date)}</td>
                    <td className="px-5 py-4 text-slate-600">{formatDate(order.pickup_date)}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/vendor/orders/${order.raw_id}`} className="rounded-md border border-[var(--navy-100)] px-3 py-2 text-sm font-bold text-[var(--navy-600)] hover:bg-[var(--navy-50)]">查看</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* 手機卡片 */}
        <div className="grid gap-3 p-4 lg:hidden">
          {filtered.map((order) => {
            const meta = statusMeta(order.status);
            return (
              <article key={order.id} className="rounded-lg border border-[var(--line)] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-[var(--navy-900)]">{order.employee_name}</p>
                    <p className="mt-0.5 text-sm text-slate-500">{order.factory_zone}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}>{meta.label}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-500">取餐 {formatDate(order.pickup_date)}</span>
                  <span className="font-black text-[var(--navy-600)]">${(order.total_amount || 0).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{order.id}</p>
                <Link href={`/vendor/orders/${order.raw_id}`} className="mt-4 inline-flex w-full justify-center rounded-md bg-[var(--navy-600)] px-3 py-2 text-sm font-bold text-white">查看訂單</Link>
              </article>
            );
          })}
        </div>

        {!filtered.length && <div className="p-8 text-center text-sm text-slate-500">目前沒有符合條件的訂單。</div>}
      </section>
    </div>
  );
}