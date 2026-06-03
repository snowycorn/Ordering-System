// app/api/orders/[id]/complete/route.js
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES, USE_LOCAL_MOCKS,
  apiFetch, jsonOrEmpty, serviceUrl, withPathParams,
} from "@/lib/api";
import { MOCK_ORDERS } from "@/lib/mockData";

function extractRawId(id) {
  const s = String(id);
  return s.startsWith("ORD-") ? s.slice(4) : s;
}

export async function PATCH(_request, { params }) {
  const { id } = await params;

  if (USE_LOCAL_MOCKS || !SERVICES.order) {
    const order = MOCK_ORDERS.find((o) => String(o.id) === String(id));
    if (order) order.status = "completed";
    return NextResponse.json({ status: "completed" });
  }

  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const rawId = extractRawId(id);

  try {
    const res = await apiFetch(
      serviceUrl(SERVICES.order, withPathParams(ENDPOINTS.orderComplete, { id: rawId })),
      { token, method: "PATCH" }
    );
    const data = await jsonOrEmpty(res);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: "訂單服務無法連線" }, { status: 503 });
  }
}
