// app/(main)/orders/[id]/page.js — 訂單明細
import Link from "next/link";
import { cookies } from "next/headers";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES, USE_LOCAL_MOCKS,
  apiFetch, jsonOrEmpty, serviceUrl,
} from "@/lib/api";
import { getMockOrder } from "@/lib/mockData";
import OrderCancelPanel from "@/components/OrderCancelPanel";
import OrderCompleteButton from "@/components/OrderCompleteButton";

const STATUS_LABELS = {
  pending: "待確認",
  confirmed: "已確認",
  ready: "可領取",
  completed: "已完成",
  cancelled: "已取消",
};

// 拿單一商家名稱（後端訂單沒回 vendor_name，前端 join）
async function getVendorName(vendorId) {
  if (!vendorId || !SERVICES.vendor) return "—";
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return "—";
  try {
    const res = await apiFetch(serviceUrl(SERVICES.vendor, ENDPOINTS.vendors), { token });
    if (!res.ok) return "—";
    const data = await jsonOrEmpty(res);
    const list = Array.isArray(data) ? data : data.vendors || [];
    const v = list.find((x) => x.id === vendorId);
    return v?.name || "—";
  } catch {
    return "—";
  }
}

async function getOrder(id) {
  if (USE_LOCAL_MOCKS || !SERVICES.order) return getMockOrder(id);

  // 從前端 ORD-xxx 還原成後端的 UUID
  const rawId = String(id).replace(/^ORD-/, "");

  const token = (await cookies()).get(COOKIE_NAME)?.value;
  try {
    const res = await apiFetch(
      serviceUrl(SERVICES.order, ENDPOINTS.orders) + `/${encodeURIComponent(rawId)}`,
      { token }
    );
    if (!res.ok) return null;
    const o = await jsonOrEmpty(res);

    // 翻譯後端欄位 → 前端格式
    const price = Number(o.price_snapshot ?? o.price ?? 0);
    const qty = Number(o.quantity ?? 1);
    const vendorName = await getVendorName(o.vendor_id);

    return {
      id: `ORD-${o.id}`,
      raw_id: o.id,
      vendor_id: o.vendor_id,
      vendor_name: vendorName,
      status: o.status,
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
  } catch {
    return null;
  }
}

export default async function OrderDetailPage({ params }) {
  const { id } = await params;
  const order = await getOrder(id);

  if (!order) {
    return (
      <div className="surface-panel mx-auto max-w-[1440px] rounded-lg p-8">
        <p className="text-sm font-semibold text-[var(--error-fg)]">找不到這筆訂單。</p>
        <Link
          href="/orders"
          className="mt-4 inline-flex text-sm font-bold text-[var(--navy-600)]"
        >
          返回歷史訂單
        </Link>
      </div>
    );
  }

  const items = order.items || [];
  const total = order.total_amount;

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6">
      <section className="surface-panel rounded-lg px-4 py-5 sm:px-6 lg:px-8">
        <Link href="/orders" className="text-sm font-bold text-[var(--navy-600)] hover:underline">
          返回歷史訂單
        </Link>
        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--teal-600)]">
              Order Detail
            </p>
            <h1 className="mt-2 text-3xl font-black text-[var(--navy-900)]">{order.id}</h1>
            <p className="mt-1 text-sm text-slate-500">
              配送日期：{order.target_date || order.order_date || "-"}・{order.vendor_name}
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-[var(--navy-50)] px-3 py-1.5 text-sm font-bold text-[var(--navy-600)]">
            {STATUS_LABELS[order.status] || order.status || "未知"}
          </span>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        {/* 左：餐點明細 */}
        <div className="surface-panel rounded-lg p-5">
          <p className="text-sm font-bold text-slate-500">餐點明細</p>
          <ul className="mt-4 divide-y divide-slate-100">
            {items.map((item, idx) => (
              <li key={idx} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-bold text-[var(--navy-900)]">{item.name}</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    ${item.price} × {item.quantity}
                  </p>
                </div>
                <span className="font-bold text-slate-900">
                  ${(item.price || 0) * (item.quantity || 1)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
            <span className="text-sm font-semibold text-slate-500">總金額</span>
            <span className="text-2xl font-black text-[var(--navy-600)]">${total}</span>
          </div>
        </div>

        {/* 右：操作面板 */}
        <div className="space-y-4">
          <OrderCompleteButton orderId={order.raw_id} status={order.status} />
          <OrderCancelPanel
            orderId={order.raw_id}
            status={order.status}
            targetDate={order.target_date}
            initialReason={order.cancel_reason || ""}
          />
        </div>
      </section>
    </div>
  );
}