// app/api/vendor/orders/[id]/route.js
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, SERVICES, apiFetch, serviceUrl } from "@/lib/api";

function extractRawId(id) {
  const s = String(id);
  return s.startsWith("ORD-") ? s.slice(4) : s;
}

function mapOrder(o) {
  const price = Number(o.price_snapshot ?? o.price ?? 0);
  const qty = Number(o.quantity ?? 1);
  return {
    id: String(o.id).startsWith("ORD-") ? o.id : `ORD-${o.id}`,
    raw_id: o.id,
    employee_name: o.employee_name ?? o.user_name ?? (o.employee_id ? `員工 #${o.employee_id}` : "未知員工"),
    status: o.status ?? "pending",
    order_date: (o.order_date ?? o.created_at)?.slice(0, 10) ?? null,
    pickup_date: o.pickup_date ?? o.target_date ?? null,
    pickup_time: o.pickup_time || "12:20",
    items: [{
      menu_id: o.menu_id,
      name: o.menu_name ?? "未知餐點",
      price,
      quantity: qty,
    }],
    total_amount: Number(o.total_price ?? o.total_amount ?? price * qty),
    note: o.note ?? "",
    user_email: o.user_email ?? o.userId ?? "企業員工",
    cancel_reason: o.cancel_reason ?? "",
  };
}

export async function GET(_request, { params }) {
  const { id } = await params;
  const rawId = extractRawId(id);
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ message: "未登入" }, { status: 401 });

  try {
    const res = await apiFetch(
      serviceUrl(SERVICES.order, `/orders/${encodeURIComponent(rawId)}`),
      { token }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ message: data.message || "找不到訂單" }, { status: res.status });
    return NextResponse.json(mapOrder(data));
  } catch (err) {
    console.error("[vendor/orders/id GET]", err);
    return NextResponse.json({ message: "伺服器錯誤" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const rawId = extractRawId(id);
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json({ message: "未登入" }, { status: 401 });

  const payload = await request.json().catch(() => ({}));

  try {
    const res = await apiFetch(
      serviceUrl(SERVICES.order, `/orders/${encodeURIComponent(rawId)}`),
      { token, method: "PATCH", body: payload }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ message: data.message || "更新失敗" }, { status: res.status });
    return NextResponse.json(mapOrder(data));
  } catch (err) {
    console.error("[vendor/orders/id PATCH]", err);
    return NextResponse.json({ message: "伺服器錯誤" }, { status: 500 });
  }
}
