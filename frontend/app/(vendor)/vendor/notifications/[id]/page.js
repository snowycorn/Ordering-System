import Link from "next/link";
import { cookies } from "next/headers";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES, USE_LOCAL_MOCKS,
  apiFetch, jsonOrEmpty, serviceUrl, withPathParams,
} from "@/lib/api";
import { getMockNotification, markMockNotificationRead } from "@/lib/mockData";

export const dynamic = "force-dynamic";

const TYPE_LABELS = { create: "訂單建立", cancel: "訂單取消", appeal: "申訴通知" };

async function loadAndRead(id) {
  if (USE_LOCAL_MOCKS || !SERVICES.notification) {
    const n = getMockNotification(id);
    if (n) markMockNotificationRead(id);
    return n;
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const userId = cookieStore.get("userId")?.value;

  try {
    const path = userId
      ? withPathParams(ENDPOINTS.notificationsByUser, { id: userId })
      : ENDPOINTS.notifications;
    const res = await apiFetch(serviceUrl(SERVICES.notification, path), { token });
    const data = await jsonOrEmpty(res);
    const list = Array.isArray(data) ? data : data.notifications || [];
    const found = list.find((n) => String(n.id) === String(id)) || null;

    if (userId) {
      await apiFetch(
        serviceUrl(
          SERVICES.notification,
          withPathParams(ENDPOINTS.notificationMarkRead, { id: userId }),
        ),
        { token, method: "PATCH", body: { ids: [Number(id)] } },
      ).catch(() => {});
    }
    return found || getMockNotification(id);
  } catch {
    return getMockNotification(id);
  }
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).format(new Date(value));
}

function getNotificationCategory(item) {
  const title = String(item.title);
  if (item.type === "appeal" || title.includes("申訴")) return "appeal";
  if (item.type === "cancel" || title.includes("取消")) return "cancel";
  return "create";
}

export default async function VendorNotificationDetailPage({ params }) {
  const { id } = await params;
  const item = await loadAndRead(id);

  if (!item) {
    return (
      <div className="surface-panel mx-auto max-w-[1440px] rounded-lg border border-slate-100 p-8 text-center shadow-sm">
        <p className="text-sm text-slate-500">找不到這則通知，可能已被刪除或權限不足。</p>
        <Link
          href="/vendor/notifications"
          className="mt-4 inline-block rounded-md bg-[var(--navy-50)] px-4 py-2 text-sm font-bold text-[var(--navy-600)] transition hover:bg-[var(--navy-100)]"
        >
          ← 返回通知中心
        </Link>
      </div>
    );
  }

  const category = getNotificationCategory(item);
  const tagColors =
    category === "cancel"
      ? "bg-[var(--error-bg)] text-[var(--error-fg)]"
      : category === "appeal"
        ? "bg-[var(--warning-bg,#fef3c7)] text-[var(--warning-fg,#b45309)]"
        : "bg-[var(--teal-50)] text-[var(--teal-600)]";

  return (
    <div className="mx-auto w-full max-w-[820px] space-y-5">
      <Link
        href="/vendor/notifications"
        className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 transition hover:text-[var(--navy-600)]"
      >
        ← 返回通知中心
      </Link>

      <article className="surface-panel rounded-lg border border-slate-100 p-6 shadow-sm sm:p-10">
        <div className="flex items-center gap-3">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${tagColors}`}>
            {TYPE_LABELS[category] || "系統通知"}
          </span>
          <p className="text-xs font-semibold text-slate-400">{formatDateTime(item.created_at)}</p>
        </div>

        <h1 className="mt-5 text-2xl font-black text-[var(--navy-900)] sm:text-3xl">{item.title}</h1>

        <div className="mt-6 border-t border-slate-100 pt-6">
          <p className="whitespace-pre-wrap text-base leading-relaxed text-slate-700">{item.content}</p>
        </div>

        <div className="mt-8 flex items-center gap-2">
          <svg className="h-4 w-4 text-[var(--success-fg)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <p className="text-sm font-medium text-slate-500">此通知已標記為已讀</p>
        </div>
      </article>
    </div>
  );
}
