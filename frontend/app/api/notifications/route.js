// app/api/notifications/route.js
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES, USE_LOCAL_MOCKS,
  apiFetch, jsonOrEmpty, serviceUrl, withPathParams,
} from "@/lib/api";
import {
  MOCK_NOTIFICATIONS, markMockNotificationRead, markAllMockNotificationsRead,
} from "@/lib/mockData";

// 把後端格式翻譯成前端習慣的格式
function toFrontend(n) {
  return {
    id: n.id,
    title: n.title,
    message: n.content ?? n.message ?? "",
    type: n.type || "system",  // 後端沒有 type，給個預設值
    created_at: n.created_at,
    read_at: n.is_read ? (n.read_at || n.created_at) : null,
  };
}

export async function GET() {
  if (USE_LOCAL_MOCKS || !SERVICES.notification) {
    return NextResponse.json(MOCK_NOTIFICATIONS);
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const userId = cookieStore.get("userId")?.value;

  // 員工要打 by-user 端點（self 權限）；沒 userId 就 fallback 到集合（admin 才會通）
  const path = userId
    ? withPathParams(ENDPOINTS.notificationsByUser, { id: userId })
    : ENDPOINTS.notifications;

  try {
    const res = await apiFetch(serviceUrl(SERVICES.notification, path), { token });
    if (!res.ok) return NextResponse.json(MOCK_NOTIFICATIONS);
    const data = await jsonOrEmpty(res);
    const list = Array.isArray(data) ? data : data.notifications || [];
    return NextResponse.json(list.map(toFrontend));
  } catch {
    return NextResponse.json(MOCK_NOTIFICATIONS);
  }
}

export async function PATCH(request) {
  const payload = await request.json().catch(() => ({}));
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const userId = cookieStore.get("userId")?.value || payload.userId || payload.user_id;

  // mock 模式：操作記憶體中的假資料
  if (USE_LOCAL_MOCKS || !SERVICES.notification) {
    if (payload.all) markAllMockNotificationsRead();
    else if (payload.id) markMockNotificationRead(payload.id);
    return NextResponse.json({ ok: true, mock: true });
  }

  if (!userId) {
    return NextResponse.json({ message: "缺少使用者 ID" }, { status: 400 });
  }

  // 後端：PATCH /notifications/user/:userId/read
  //   - body { ids: [id] }   → 標單筆
  //   - body {}              → 全部標已讀
  const body = payload.all ? {} : payload.id ? { ids: [Number(payload.id)] } : {};

  try {
    const res = await apiFetch(
      serviceUrl(SERVICES.notification, withPathParams(ENDPOINTS.notificationMarkRead, { id: userId })),
      { token, method: "PATCH", body }
    );
    const data = await jsonOrEmpty(res);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: "通知服務無法連線" }, { status: 503 });
  }
}