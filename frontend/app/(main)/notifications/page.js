import Link from "next/link";
import { cookies } from "next/headers";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES, USE_LOCAL_MOCKS,
  apiFetch, jsonOrEmpty, serviceUrl, withPathParams,
} from "@/lib/api";
import { MOCK_NOTIFICATIONS } from "@/lib/mockData";
import MarkAllReadButton from "@/components/MarkAllReadButton";

export const dynamic = "force-dynamic";

const TYPE_META = {
  create: { label: "訂單建立", className: "border-[var(--teal-400)] bg-[var(--teal-50)] text-[var(--teal-600)]" },
  cancel: { label: "訂單取消", className: "border-[var(--error-fg)] bg-[var(--error-bg)] text-[var(--error-fg)]" },
  appeal: { label: "申訴通知", className: "border-[var(--navy-600)] bg-[var(--navy-50)] text-[var(--navy-600)]" },
};

async function getNotifications() {
  if (USE_LOCAL_MOCKS || !SERVICES.notification) return MOCK_NOTIFICATIONS;
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const userId = cookieStore.get("userId")?.value;
  const path = userId ? withPathParams(ENDPOINTS.notificationsByUser, { id: userId }) : ENDPOINTS.notifications;
  try {
    const res = await apiFetch(serviceUrl(SERVICES.notification, path), { token });
    if (!res.ok) return MOCK_NOTIFICATIONS;
    const data = await jsonOrEmpty(res);
    return Array.isArray(data) ? data : data.notifications || MOCK_NOTIFICATIONS;
  } catch {
    return MOCK_NOTIFICATIONS;
  }
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function getNotificationCategory(item) {
  if (item.type === "appeal" || String(item.title).includes("申訴")) return "appeal";
  if (item.type === "cancel" || String(item.title).includes("取消")) return "cancel";
  return "create";
}

export default async function NotificationsPage() {
  const items = await getNotifications();
  const isUnread = (n) => !n.read_at && !n.is_read;
  
  const unreadCount = items.filter(isUnread).length;
  const cancelCount = items.filter((i) => getNotificationCategory(i) === "cancel").length;
  const createCount = items.filter((i) => getNotificationCategory(i) === "create").length;
  const appealCount = items.filter((i) => getNotificationCategory(i) === "appeal").length;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <section className="surface-panel rounded-lg px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--teal-600)]">Notifications</p>
            <h1 className="mt-2 text-3xl font-black text-[var(--navy-900)]">通知中心</h1>
            <p className="mt-2 text-sm text-slate-600">隨時掌握訂單的最新動態。</p>
          </div>
          <MarkAllReadButton disabled={!unreadCount} />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-4">
        <Stat label="未讀通知" value={unreadCount} tone="blue" />
        <Stat label="訂單已建立" value={createCount} tone="green" />
        <Stat label="訂單已取消" value={cancelCount} tone="red" />
        <Stat label="申訴通知" value={appealCount} tone="navy" />
      </section>

      <section className="surface-panel overflow-hidden rounded-lg shadow-sm border border-slate-100">
        {!items.length ? (
          <div className="p-8 text-center text-sm text-slate-500">目前沒有任何通知。</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {items.map((item) => {
              // 取得確保一致的分類
              const category = getNotificationCategory(item);
              const meta = TYPE_META[category];
              const unread = isUnread(item);
              
              return (
                <Link 
                  key={item.id} 
                  href={`/notifications/${item.id}`} 
                  // 移除之前的藍色背景，改回單純的底色變化
                  className={`grid gap-4 p-5 transition lg:grid-cols-[auto_1fr_auto] lg:items-center ${
                    unread ? "bg-[var(--surface-muted)] hover:bg-slate-100" : "bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* 未讀紅點標示改回原本無背景，依靠未讀標籤 */}
                    <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${meta.className}`}>
                      {meta.label}
                    </span>
                  </div>
                  
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-black text-[var(--navy-900)]">
                        {item.title}
                      </h2>
                      {/* 恢復原版的「未讀」Badge */}
                      {unread && (
                        <span className="rounded-full bg-[var(--error-fg)] px-2 py-0.5 text-xs font-bold text-white">
                          未讀
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm text-slate-600">
                      {item.message}
                    </p>
                    <p className="mt-2 text-xs font-semibold text-slate-400">
                      {formatDateTime(item.created_at)}
                    </p>
                  </div>
                  
                  <span className="text-sm font-bold text-[var(--navy-600)] hidden lg:block">
                    查看內容 →
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

function Stat({ label, value, tone }) {
  // 將 tone="blue" 的樣式完美還原為你最初始的 var(--navy) 設定
  const className =
    tone === "green"
      ? "border-[var(--teal-400)] bg-[var(--teal-50)] text-[var(--teal-600)]"
      : tone === "red"
        ? "border-[var(--error-fg)] bg-[var(--error-bg)] text-[var(--error-fg)]"
        : tone === "navy"
          ? "border-[var(--navy-400)] bg-[var(--navy-50)] text-[var(--navy-700)]"
          : "border-[var(--navy-600)] bg-[var(--navy-50)] text-[var(--navy-600)]";
        
  return (
    <div className={`border-l-4 p-5 ${className}`}>
      <p className="text-sm font-bold">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}