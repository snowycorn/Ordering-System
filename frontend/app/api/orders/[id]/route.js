// app/api/orders/[id]/route.js
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES, USE_LOCAL_MOCKS,
  apiFetch, jsonOrEmpty, serviceUrl, withPathParams,
} from "@/lib/api";
import { MOCK_ORDERS } from "@/lib/mockData";

function mockOrder(id) {
  return MOCK_ORDERS.find((o) => String(o.id) === String(id)) || null;
}

// 從前端的 ORD-123 拿出後端的 123
function extractRawId(id) {
  const s = String(id);
  return s.startsWith("ORD-") ? s.slice(4) : s;
}

export async function GET(_request, { params }) {
  const { id } = await params;

  if (USE_LOCAL_MOCKS || !SERVICES.order) {
    const order = mockOrder(id);
    return order ? NextResponse.json(order) : NextResponse.json({ message: "找不到訂單" }, { status: 404 });
  }

  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const rawId = extractRawId(id);

  try {
    const res = await apiFetch(
      serviceUrl(SERVICES.order, `${ENDPOINTS.orders}/${encodeURIComponent(rawId)}`),
      { token }
    );
    if (!res.ok) {
      const order = mockOrder(id);
      return order
        ? NextResponse.json(order)
        : NextResponse.json({ message: "找不到訂單" }, { status: res.status });
    }
    const o = await jsonOrEmpty(res);
    return NextResponse.json({
      id: `ORD-${o.id}`,
      raw_id: o.id,
      vendor_id: o.vendor_id,
      vendor_name: o.vendor_name || "—",
      status: o.status,
      order_date: o.created_at?.slice(0, 10),
      target_date: o.pickup_date,
      pickup_time: "12:20",
      items: [{
        menu_id: o.menu_id,
        name: o.menu_name,
        price: Number(o.price),
        quantity: Number(o.quantity),
      }],
      total_amount: Number(o.price) * Number(o.quantity),
      cancel_reason: o.cancel_reason || "",
    });
  } catch {
    const order = mockOrder(id);
    return order ? NextResponse.json(order) : NextResponse.json({ message: "找不到訂單" }, { status: 404 });
  }
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const payload = await request.json().catch(() => ({}));
  const cancelReason = payload.cancel_reason || payload.reason || "";

  if (USE_LOCAL_MOCKS || !SERVICES.order) {
    return NextResponse.json({
      ...mockOrder(id),
      status: "cancelled",
      cancel_reason: cancelReason,
    });
  }

  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const rawId = extractRawId(id);

  try {
    // 注意:訂單服務的取消是 PATCH /orders/:id/cancel，不是 DELETE
    const res = await apiFetch(
      serviceUrl(SERVICES.order, withPathParams(ENDPOINTS.orderCancel, { id: rawId })),
      { token, method: "PATCH", body: { reason: cancelReason } }
    );
    const data = await jsonOrEmpty(res);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: "訂單服務無法連線" }, { status: 503 });
  }
}