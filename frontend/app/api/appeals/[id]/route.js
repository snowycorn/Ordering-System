// app/api/appeals/[id]/route.js
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES, USE_LOCAL_MOCKS,
  apiFetch, jsonOrEmpty, serviceUrl,
} from "@/lib/api";
import { getMockAppeal } from "@/lib/mockData";

function mapStatusFromBackend(s) {
  if (s === "pending") return "submitted";
  if (s === "approved") return "resolved";
  if (s === "rejected") return "rejected";
  return s || "submitted";
}

function toFrontend(a) {
  let reasonCode = "other";
  let message = a.reason || "";
  const m = /^\[([^\]]+)\]\s*(.*)$/s.exec(message);
  if (m) { reasonCode = m[1]; message = m[2]; }
  return {
    id: `APL-${a.id}`,
    raw_id: a.id,
    order_id: a.order_id,
    employee_id: a.employee_id,
    reason: reasonCode,
    message,
    status: mapStatusFromBackend(a.status),
    refund_amount: a.refund_amount,
    admin_notes: a.admin_notes,
    created_at: a.created_at,
  };
}

export async function GET(_request, { params }) {
  const { id } = await params;

  if (USE_LOCAL_MOCKS || !SERVICES.appeal) {
    const appeal = getMockAppeal(id);
    return appeal
      ? NextResponse.json(appeal)
      : NextResponse.json({ message: "找不到申訴案件" }, { status: 404 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const userId = cookieStore.get("userId")?.value;

  // 從前端的「APL-7」拿到後端真正的 id「7」
  const rawId = String(id).replace(/^APL-/, "");

  if (!userId) {
    return NextResponse.json({ message: "未登入" }, { status: 401 });
  }

  try {
    // 後端沒有單筆查詢給員工，所以撈 by-user 後自己挑
    const res = await apiFetch(
      serviceUrl(SERVICES.appeal, `${ENDPOINTS.appeals}/user/${encodeURIComponent(userId)}`),
      { token }
    );
    if (!res.ok) {
      return NextResponse.json({ message: "讀取失敗" }, { status: res.status });
    }
    const data = await jsonOrEmpty(res);
    const list = Array.isArray(data) ? data : data.appeals || [];
    const found = list.find((a) => String(a.id) === rawId);
    return found
      ? NextResponse.json(toFrontend(found))
      : NextResponse.json({ message: "找不到申訴案件" }, { status: 404 });
  } catch {
    return NextResponse.json({ message: "申訴服務無法連線" }, { status: 503 });
  }
}