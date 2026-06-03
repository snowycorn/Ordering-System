// app/api/vendor/orders/[id]/reject/route.js
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, SERVICES, apiFetch, serviceUrl } from "@/lib/api";

export async function PATCH(request, { params }) {
  const { id }  = await params;
  const token   = (await cookies()).get(COOKIE_NAME)?.value;
  const payload = await request.json().catch(() => ({}));

  if (!token) return NextResponse.json({ message: "未登入" }, { status: 401 });

  try {
    const res = await apiFetch(
      serviceUrl(SERVICES.order, `/vendor/orders/${id}/reject`),
      { method: "PATCH", token, body: payload }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return NextResponse.json({ message: data.message || "拒單失敗" }, { status: res.status });
    return NextResponse.json(data);
  } catch (err) {
    console.error("[vendor/orders/reject]", err);
    return NextResponse.json({ message: "伺服器錯誤" }, { status: 500 });
  }
}