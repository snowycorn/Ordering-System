// app/(vendor)/vendor/menus/page.js
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
import { MOCK_MENUS, MOCK_ORDERS } from "@/lib/mockData";
import Link from "next/link";

async function getMenus() {
  if (!SERVICES.vendor) return MOCK_MENUS;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  try {
    const res = await apiFetch(serviceUrl(SERVICES.vendor, ENDPOINTS.vendorMeMenus), { token });
    if (!res.ok) return MOCK_MENUS;
    const data = await jsonOrEmpty(res);
    return Array.isArray(data) ? data : data.menus || MOCK_MENUS;
  } catch {
    return MOCK_MENUS;
  }
}

async function getUpcomingOrders() {
  if (USE_LOCAL_MOCKS) return MOCK_ORDERS;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!SERVICES.order || !token) return [];

  try {
    const vendorId = (await cookies()).get("userId")?.value;
    if (!vendorId) return [];

    const today = new Date();
    const tzOffset = today.getTimezoneOffset() * 60000;
    const fmt = (d) => new Date(d.getTime() - tzOffset).toISOString().split("T")[0];
    const nextWeek = new Date(today.getTime() + 7 * 86400000);

    const url = `${serviceUrl(SERVICES.order, `/vendor/orders/vendor/${vendorId}`)}?from=${fmt(today)}&to=${fmt(nextWeek)}`;
    const res = await apiFetch(url, { token });
    if (!res.ok) return [];

    const data = await jsonOrEmpty(res);
    const list = Array.isArray(data) ? data : data.orders ?? [];
    return list.map((o) => ({
      menu_name:   o.menu_name ?? o.items?.[0]?.name ?? "",
      pickup_date: o.pickup_date ?? o.target_date ?? null,
      quantity:    Number(o.quantity ?? 1),
      status:      o.status ?? "pending",
    }));
  } catch {
    return [];
  }
}

function buildWeeklyAvail(menu, orderedMap, upcomingDays) {
  return upcomingDays.map(({ date, label }, i) => {
    const ordered = orderedMap[date]?.[menu.name] ?? 0;
    const remaining = i === 0
      ? Number(menu.effectiveDailyLimit ?? 0)
      : Math.max(0, Number(menu.dailyLimit ?? 0) - ordered);
    return { date, label, remaining, dailyLimit: Number(menu.dailyLimit ?? 0) };
  });
}

export default async function VendorMenusPage() {
  const [menus, orders] = await Promise.all([getMenus(), getUpcomingOrders()]);

  // Build date list for upcoming 7 days
  const today = new Date();
  const tzOffset = today.getTimezoneOffset() * 60000;
  const upcomingDays = Array.from({ length: 7 }, (_, i) => {
    const [y, m, d] = new Date(today.getTime() - tzOffset + i * 86400000)
      .toISOString().split("T")[0].split("-").map(Number);
    const date = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const label = `${m}/${d}`; 

    return { date, label };
  });

  // orderedMap[date][menu_name] = qty (excluding cancelled)
  const orderedMap = {};
  for (const o of orders) {
    if (o.status === "cancelled" || !o.pickup_date || !o.menu_name) continue;
    if (!orderedMap[o.pickup_date]) orderedMap[o.pickup_date] = {};
    orderedMap[o.pickup_date][o.menu_name] =
      (orderedMap[o.pickup_date][o.menu_name] ?? 0) + o.quantity;
  }

  const available = menus.filter((m) => m.isActive);
  const inactive  = menus.filter((m) => !m.isActive);

  return (
    <div className="w-full space-y-6">

      {/* 標題 */}
      <section className="surface-panel rounded-lg px-4 py-5 sm:px-6 lg:px-7">
        <Link href="/vendor" className="text-xs font-semibold text-[var(--teal-600)] hover:underline">
          ← 返回工作台
        </Link>
        <div className="mt-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-[var(--navy-900)]">菜單管理</h1>
            <p className="mt-1 text-sm text-slate-500">管理所有餐點品項與每日供應數量</p>
          </div>
          <Link
            href="/vendor/menus/new"
            className="inline-flex min-h-10 items-center justify-center rounded-md bg-[var(--navy-600)] px-5 text-sm font-bold text-white transition hover:bg-[var(--navy-800)]"
          >
            + 新增餐點
          </Link>
        </div>
      </section>

      {/* 統計 */}
      <section className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "全部餐點", value: menus.length,     color: "border-[var(--navy-600)] bg-[var(--navy-50)] text-[var(--navy-600)]" },
          { label: "供應中",   value: available.length, color: "border-[var(--teal-400)] bg-[var(--teal-50)] text-[var(--teal-600)]" },
          { label: "今日售完", value: menus.filter((m) => m.isActive && Number(m.effectiveDailyLimit ?? 0) === 0).length, color: "border-orange-300 bg-orange-50 text-orange-500" },
          { label: "已停用",   value: inactive.length,  color: "border-slate-300 bg-slate-50 text-slate-500" },
        ].map((s) => (
          <div key={s.label} className={`rounded-lg border-l-4 p-4 ${s.color}`}>
            <p className="text-sm font-bold">{s.label}</p>
            <p className="mt-1 text-2xl font-black">{s.value}</p>
          </div>
        ))}
      </section>

      {/* 供應中 */}
      {available.length > 0 && (
        <section className="surface-panel rounded-lg p-5">
          <h2 className="mb-4 text-lg font-black text-[var(--navy-900)]">供應中</h2>
          <div className="flex flex-col gap-3">
            {available.map((menu) => (
              <MenuCard
                key={menu.id}
                menu={menu}
                weeklyAvail={buildWeeklyAvail(menu, orderedMap, upcomingDays)}
              />
            ))}
          </div>
        </section>
      )}

      {/* 今日售完（isActive 但今天 effectiveDailyLimit === 0） */}
      {menus.some((m) => m.isActive && Number(m.effectiveDailyLimit ?? 0) === 0) && (
        <section className="surface-panel rounded-lg p-5">
          <h2 className="mb-4 text-lg font-black text-orange-400">今日售完</h2>
          <div className="flex flex-col gap-3">
            {menus
              .filter((m) => m.isActive && Number(m.effectiveDailyLimit ?? 0) === 0)
              .map((menu) => (
                <MenuCard
                  key={menu.id}
                  menu={menu}
                  weeklyAvail={buildWeeklyAvail(menu, orderedMap, upcomingDays)}
                  todaySoldOut
                />
              ))}
          </div>
        </section>
      )}

      {/* 已停用 */}
      {inactive.length > 0 && (
        <section className="surface-panel rounded-lg p-5">
          <h2 className="mb-4 text-lg font-black text-slate-400">已停用</h2>
          <div className="flex flex-col gap-3">
            {inactive.map((menu) => (
              <MenuCard key={menu.id} menu={menu} disabled />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MenuCard({ menu, weeklyAvail = [], todaySoldOut = false, disabled = false }) {
  const dimmed = disabled;

  return (
    <article
      className={`flex flex-col sm:flex-row gap-4 overflow-hidden rounded-md border p-4 transition-colors ${
        dimmed ? "border-slate-100 bg-slate-50 opacity-60" : "border-[var(--line)] bg-white hover:border-[var(--teal-300)]"
      }`}
    >
      {/* 區塊 1：左側餐點圖片 */}
      <div className="relative h-24 w-full shrink-0 sm:h-28 sm:w-28">
        {menu.imageUrl ? (
          <img
            src={menu.imageUrl}
            alt={menu.name}
            className="h-full w-full rounded-md object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-md bg-slate-100 text-xs text-slate-400">
            無圖片
          </div>
        )}
      </div>

      {/* 區塊 2：中間餐點資訊 */}
      <div className="flex min-w-[150px] flex-1 flex-col justify-center">
        <h3 className="text-lg font-black text-[var(--navy-900)]">{menu.name}</h3>
        <div className="mt-1 flex flex-wrap gap-1">
          {Array.isArray(menu.tags) && menu.tags.length > 0 ? (
            menu.tags.map((tag, index) => (
              <span
                key={index}
                className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold tracking-wider text-slate-600"
              >
                {tag}
              </span>
            ))
          ) : (
            <span className="text-xs text-slate-400 italic">未分類</span>
          )}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <span className="text-xl font-black text-[var(--navy-600)]">${menu.price}</span>
          {todaySoldOut && !disabled && (
            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-bold text-orange-500 border border-orange-200">
              今日售完
            </span>
          )}
          {disabled && (
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-500">
              已停用
            </span>
          )}
        </div>
      </div>

      {/* 區塊 3：右側週間供應量 (List 模式) */}
      {!disabled && weeklyAvail.length > 0 && (
        <div className="flex shrink-0 flex-col justify-center border-t border-slate-100 pt-3 sm:w-[320px] sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span className="font-bold text-[var(--navy-800)]">一週供應狀況</span>
            <span>每日上限 {menu.dailyLimit ?? 0}</span>
          </div>
          <div className="flex w-full justify-between gap-1">
            {weeklyAvail.map(({ date, label, remaining, dailyLimit }) => {
              const pct = dailyLimit > 0 ? Math.round((remaining / dailyLimit) * 100) : 0;
              const barColor =
                remaining === 0 ? "bg-red-300"
                : pct <= 30     ? "bg-orange-300"
                                : "bg-[var(--teal-400)]";
              const textColor =
                remaining === 0 ? "text-red-400"
                : pct <= 30     ? "text-orange-500"
                                : "text-[var(--teal-600)]";
              return (
                <div key={date} className="flex flex-col items-center gap-1 w-8">
                  <span className="text-[10px] font-medium text-slate-400">{label}</span>
                  {/* 改成直立細長條 */}
                  <div className="h-10 w-3 overflow-hidden rounded-sm bg-slate-100 flex flex-col justify-end">
                    <div className={`w-full ${barColor} transition-all`} style={{ height: `${pct}%` }} />
                  </div>
                  <span className={`text-[10px] font-bold ${textColor}`}>
                    {remaining === 0 ? "0" : remaining}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 區塊 4：最右側操作按鈕 */}
      <div className="flex items-center justify-end border-t border-slate-100 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
        <Link
          href={`/vendor/menus/${menu.id}/edit`}
          className="rounded-md border border-[var(--teal-600)] px-4 py-2 text-sm font-bold text-[var(--teal-600)] transition hover:bg-[var(--teal-50)]"
        >
          編輯
        </Link>
      </div>
    </article>
  );
}