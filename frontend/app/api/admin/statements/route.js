// app/api/admin/statements/route.js — 帳單列表 + 建立
// 由於 billing service 偶爾回 order_count = 0 但金額不為 0，
// BFF 在回前端前，從 order service 查正確的 completed 訂單數，
// 把 order_count 替換成正確值（cross-service aggregation）
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES,
  apiFetch, jsonOrEmpty, serviceUrl,
} from "@/lib/api";

// 算某個月份的 from / to 日期
function getMonthRange(period) {
  // period 格式: "2026-06"
  const [year, month] = String(period).split("-");
  if (!year || !month) return null;
  const lastDay = new Date(Number(year), Number(month), 0).getDate();
  return {
    from: `${year}-${month}-01`,
    to: `${year}-${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

// 用 vendor_user_id (integer) + 月份 範圍查 completed 訂單數
async function getCompletedOrderCount(vendorUserId, period, token) {
  if (!vendorUserId || !period || !SERVICES.order) return null;
  const range = getMonthRange(period);
  if (!range) return null;

  try {
    const url = `${SERVICES.order}/vendor/orders/completed/${vendorUserId}?from=${range.from}&to=${range.to}`;
    const res = await apiFetch(url, { token });
    if (!res.ok) return null;
    const data = await jsonOrEmpty(res);
    // 後端可能回 array、或 { orders: [...] }、或 { count: N }
    if (Array.isArray(data)) return data.length;
    if (Array.isArray(data?.orders)) return data.orders.length;
    if (typeof data?.count === "number") return data.count;
    if (typeof data?.total === "number") return data.total;
    return null;
  } catch {
    return null;
  }
}

export async function GET() {
  if (!SERVICES.billing) return NextResponse.json({ message: "帳單服務未設定" }, { status: 503 });
  const token = (await cookies()).get(COOKIE_NAME)?.value;

  try {
    // 1. 撈 billing 的 statements 列表
    const res = await apiFetch(serviceUrl(SERVICES.billing, ENDPOINTS.billingStatements), { token });
    if (!res.ok) {
      return NextResponse.json(await jsonOrEmpty(res), { status: res.status });
    }
    const data = await jsonOrEmpty(res);
    const statements = Array.isArray(data) ? data : (data.statements || data || []);

    // 2. 對每筆 statement，去 order service 查正確的 completed 訂單數
    const enriched = await Promise.all(
      statements.map(async (s) => {
        const vendorUserId = s.vendor_id;  // billing 內存的就是 user_id (integer)
        const period = s.statement_period || s.period;
        const realCount = await getCompletedOrderCount(vendorUserId, period, token);

        // 如果有拿到正確 count，用它覆蓋 billing 給的 order_count
        if (realCount !== null) {
          return { ...s, order_count: realCount };
        }
        // 拿不到就用 billing 原本的（fallback）
        return s;
      })
    );

    return NextResponse.json(enriched, { status: 200 });
  } catch {
    return NextResponse.json({ message: "服務無法連線" }, { status: 503 });
  }
}

export async function POST(request) {
  if (!SERVICES.billing) return NextResponse.json({ message: "帳單服務未設定" }, { status: 503 });
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const body = await request.json().catch(() => ({}));

  try {
    const res = await apiFetch(serviceUrl(SERVICES.billing, ENDPOINTS.billingStatements), {
      token,
      method: "POST",
      body,
    });
    let data = await jsonOrEmpty(res);

    // POST 完成後也把正確 count 補上（建立完馬上要顯示給福委會看）
    if (res.ok && data) {
      const vendorUserId = body?.vendor_id ?? data?.vendor_id;
      const period = data?.statement_period || data?.period || body?.statement_period;
      const realCount = await getCompletedOrderCount(vendorUserId, period, token);
      if (realCount !== null) {
        data = { ...data, order_count: realCount };
      }
    }

    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: "服務無法連線" }, { status: 503 });
  }
}