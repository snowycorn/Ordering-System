// app/api/orders/route.js — 訂單 BFF (Backend For Frontend)
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES, USE_LOCAL_MOCKS,
  apiFetch, jsonOrEmpty, serviceUrl,
} from "@/lib/api";
import { MOCK_ORDERS } from "@/lib/mockData";

// 後端訂單翻譯成前端格式
function toFrontendOrder(o) {
  const price = Number(o.price_snapshot ?? o.price ?? 0);
  const qty = Number(o.quantity ?? 1);
  return {
    id: `ORD-${o.id}`,
    raw_id: o.id,
    vendor_id: o.vendor_id,
    vendor_name: o.vendor_name || "—",
    status: o.status, // pending / confirmed / cancelled / completed
    order_date: (o.order_date || o.created_at)?.slice(0, 10),
    target_date: o.pickup_date,
    pickup_time: "12:20",
    items: [{
      menu_id: o.menu_id,
      name: o.menu_name,
      price,
      quantity: qty,
    }],
    total_amount: Number(o.total_price ?? price * qty),
    cancel_reason: o.cancel_reason || "",
  };
}

// mock 模式假訂單
function createMockOrder(payload) {
  const items = Array.isArray(payload.items) && payload.items.length
    ? payload.items.map((i) => ({
        menu_id: i.menu_id,
        name: i.name,
        price: Number(i.price),
        quantity: Number(i.quantity),
      }))
    : [{ menu_id: payload.menu_id, name: "示範餐點", price: 100, quantity: 1 }];
  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
  return {
    id: `ORD-DEMO-${Date.now()}`,
    vendor_name: payload.vendor_name || "示範商家",
    items,
    total_amount: total,
    status: "confirmed",
    order_date: new Date().toISOString().slice(0, 10),
    target_date: payload.target_date || payload.targetDate || new Date().toISOString().slice(0, 10),
    pickup_time: "12:20",
    cancel_reason: "",
    mock: true,
  };
}

export async function GET() {
  if (USE_LOCAL_MOCKS || !SERVICES.order) {
    return NextResponse.json(MOCK_ORDERS);
  }

  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return NextResponse.json(MOCK_ORDERS);

  try {
    // 後端 /orders/me 預設只回 today，要打三個 range 合併才完整
    const baseUrl = serviceUrl(SERVICES.order, ENDPOINTS.ordersMe);
    const [todayRes, upcomingRes, historyRes] = await Promise.all([
      apiFetch(`${baseUrl}?range=today`, { token }),
      apiFetch(`${baseUrl}?range=upcoming`, { token }),
      apiFetch(`${baseUrl}?range=history`, { token }),
    ]);

    const today = todayRes.ok ? (await jsonOrEmpty(todayRes)).orders || [] : [];
    const upcoming = upcomingRes.ok ? (await jsonOrEmpty(upcomingRes)).orders || [] : [];
    const history = historyRes.ok ? (await jsonOrEmpty(historyRes)).orders || [] : [];

    // 去重（後端不同 range 可能有重複）
    const combined = [...today, ...upcoming, ...history];
    const seen = new Set();
    const unique = combined.filter((o) => {
      if (seen.has(o.id)) return false;
      seen.add(o.id);
      return true;
    });

    // 依取餐日期倒序
    unique.sort((a, b) => (b.pickup_date || "").localeCompare(a.pickup_date || ""));

    return NextResponse.json(unique.map(toFrontendOrder));
  } catch {
    return NextResponse.json(MOCK_ORDERS);
  }
}

export async function POST(request) {
  const payload = await request.json().catch(() => ({}));
  const hasItems = Array.isArray(payload.items) && payload.items.length > 0;
  if (!hasItems && !payload.menuId && !payload.menu_id) {
    return NextResponse.json({ message: "購物車是空的" }, { status: 400 });
  }

  if (USE_LOCAL_MOCKS || !SERVICES.order) {
    return NextResponse.json(createMockOrder(payload), { status: 201 });
  }

  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const items = hasItems
    ? payload.items
    : [{ menu_id: payload.menuId || payload.menu_id, name: "餐點", price: 0, quantity: 1 }];

  // 訂單服務一筆品項一張 API call，平行送出
  const results = await Promise.allSettled(
    items.map((item) =>
      apiFetch(serviceUrl(SERVICES.order, ENDPOINTS.orders), {
        token,
        method: "POST",
        body: {
          menu_id: item.menu_id,
          quantity: Number(item.quantity),
          pickup_date: payload.target_date || payload.targetDate,
          factoryZone: payload.factory_zone || payload.factoryZone || "",
        },
      }).then(async (r) => ({ ok: r.ok, status: r.status, data: await jsonOrEmpty(r) }))
    )
  );

  const successes = results.filter((r) => r.status === "fulfilled" && r.value.ok);
  const failures = results.filter((r) => r.status !== "fulfilled" || !r.value.ok);

  if (failures.length > 0) {
    const firstError = failures[0];
    const msg = firstError.value?.data?.detail || firstError.value?.data?.message || "部分品項下單失敗";
    return NextResponse.json(
      { message: msg, successCount: successes.length, failureCount: failures.length },
      { status: 207 } // Multi-Status
    );
  }

  return NextResponse.json({ ok: true, count: successes.length }, { status: 201 });
}