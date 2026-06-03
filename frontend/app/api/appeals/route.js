// app/api/appeals/route.js — 申訴 BFF
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES, USE_LOCAL_MOCKS,
  apiFetch, jsonOrEmpty, serviceUrl,
} from "@/lib/api";
import { MOCK_APPEALS } from "@/lib/mockData";

// 後端 status → 前端 status
function mapStatusFromBackend(s) {
  if (s === "pending") return "submitted";
  if (s === "approved") return "resolved";
  if (s === "rejected") return "rejected";
  return s || "submitted";
}

// 後端的 reason 是「[類型代碼] 文字描述」的合併字串，拆回兩個欄位
function parseReason(reason) {
  let code = "other";
  let message = reason || "";
  const m = /^\[([^\]]+)\]\s*(.*)$/s.exec(message);
  if (m) {
    code = m[1];
    message = m[2];
  }
  return { code, message };
}

function toFrontend(a) {
  const { code, message } = parseReason(a.reason);
  return {
    id: `APL-${a.id}`,
    raw_id: a.id,
    order_id: a.order_id,
    employee_id: a.employee_id,
    vendor_id: a.vendor_id,
    reason: code,
    message,
    status: mapStatusFromBackend(a.status),
    refund_amount: a.refund_amount,
    admin_notes: a.admin_notes,
    created_at: a.created_at,
  };
}

export async function POST(request) {
  const payload = await request.json().catch(() => ({}));

  if (!payload.orderId && !payload.order_id) {
    return NextResponse.json({ message: "請選擇關聯訂單" }, { status: 400 });
  }
  if (!payload.message) {
    return NextResponse.json({ message: "請輸入申訴內容" }, { status: 400 });
  }

  if (USE_LOCAL_MOCKS || !SERVICES.appeal) {
    return NextResponse.json(
      { id: `APL-DEMO-${Date.now()}`, status: "submitted", ...payload, mock: true },
      { status: 201 }
    );
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const userId = Number(cookieStore.get("userId")?.value);

  // 拆掉前端的 ORD- 前綴,直接傳純 UUID 給後端
  const rawOrderInput = payload.orderId || payload.order_id;
  const orderId = String(rawOrderInput).replace(/^ORD-/, "");

  // 把前端的「類型 + 描述」合併成後端要的 reason 一個欄位
  const reason = `[${payload.reason || "other"}] ${payload.message}`;

  const body = {
    order_id: orderId,           // 純 UUID 字串
    reason,
    employee_id: userId,
  };

  try {
    const res = await apiFetch(serviceUrl(SERVICES.appeal, ENDPOINTS.appeals), {
      token,
      method: "POST",
      body,
    });
    const data = await jsonOrEmpty(res);
    if (!res.ok) {
      return NextResponse.json(
        { message: data.error || data.message || "送出申訴失敗" },
        { status: res.status }
      );
    }
    return NextResponse.json(toFrontend(data), { status: 201 });
  } catch {
    return NextResponse.json({ message: "申訴服務無法連線" }, { status: 503 });
  }
}

export async function GET() {
  if (USE_LOCAL_MOCKS || !SERVICES.appeal) {
    return NextResponse.json(MOCK_APPEALS);
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const userId = cookieStore.get("userId")?.value;
  const role = cookieStore.get("role")?.value;

  // employee 只看自己,admin 看全部
  const path =
    role === "admin"
      ? ENDPOINTS.appeals
      : `${ENDPOINTS.appeals}/user/${encodeURIComponent(userId)}`;

  try {
    const res = await apiFetch(serviceUrl(SERVICES.appeal, path), { token });
    if (!res.ok) return NextResponse.json(MOCK_APPEALS);
    const data = await jsonOrEmpty(res);
    const list = Array.isArray(data) ? data : data.appeals || [];
    return NextResponse.json(list.map(toFrontend));
  } catch {
    return NextResponse.json(MOCK_APPEALS);
  }
}