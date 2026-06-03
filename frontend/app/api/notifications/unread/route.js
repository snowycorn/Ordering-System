// app/api/notifications/unread/route.js
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES, USE_LOCAL_MOCKS,
  apiFetch, jsonOrEmpty, serviceUrl, withPathParams,
} from "@/lib/api";
import { MOCK_NOTIFICATIONS } from "@/lib/mockData";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const userId = cookieStore.get("userId")?.value;

  if (USE_LOCAL_MOCKS || !SERVICES.notification) {
    const count = MOCK_NOTIFICATIONS.filter((n) => !n.read_at && !n.is_read).length;
    return NextResponse.json({ unread: count });
  }

  if (!token || !userId) return NextResponse.json({ unread: 0 });

  try {
    const path = withPathParams(ENDPOINTS.notificationsByUser, { id: userId });
    const res = await apiFetch(serviceUrl(SERVICES.notification, path), { token });
    if (!res.ok) return NextResponse.json({ unread: 0 });

    const data = await jsonOrEmpty(res);
    const list = Array.isArray(data) ? data : data.notifications || [];
    const unread = list.filter((n) => !n.is_read && !n.read_at).length;
    return NextResponse.json({ unread });
  } catch {
    return NextResponse.json({ unread: 0 });
  }
}