// app/api/admin/appeals/notify/route.js
// 福委會審核完申訴後，發通知給員工 + 商家
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, SERVICES, apiFetch, jsonOrEmpty } from "@/lib/api";

// 用 vendor_id 查商家名稱（讓通知好看）
async function getVendorName(vendorId, token) {
  if (!vendorId || !SERVICES.vendor) return "";
  try {
    const res = await apiFetch(`${SERVICES.vendor}/api/v1/vendors`, { token });
    if (!res.ok) return "";
    const data = await jsonOrEmpty(res);
    const list = Array.isArray(data) ? data : data.vendors || [];
    return list.find((v) => v.id === vendorId)?.name || "";
  } catch {
    return "";
  }
}

// 發單筆通知 (負責封裝 Token 與 POST 方法)
async function sendNotification({ user_id, title, content, token }) {
  if (!user_id || !SERVICES.notification) return false;
  try {
    const res = await apiFetch(`${SERVICES.notification}/notifications`, {
      token,
      method: "POST",
      body: { user_id, title, content },
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(request) {
  const payload = await request.json().catch(() => ({}));
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const {
    appealId,
    action,         // "approve" | "reject"
    refund = 0,
    adminNotes = "",
    employeeId,
    vendorId,
    orderId,
  } = payload;

  const vendorName = await getVendorName(vendorId, token);
  const shortOrderId = String(orderId || "").slice(0, 8);
  const results = { employeeNotified: false, vendorNotified: false };

  // === 通知員工 ===
  if (action === "approve") {
    results.employeeNotified = await sendNotification({
      user_id: employeeId,
      title: `您的申訴已核准（APL-${appealId}）`,
      content: `您針對訂單 ORD-${shortOrderId}（${vendorName || "—"}）提出的申訴已通過審核。\n\n退款金額：NT$ ${refund}\n${adminNotes ? `備註：${adminNotes}\n` : ""}款項將以原付款方式退回，謝謝您的回報。`,
      token,
    });
  } else {
    results.employeeNotified = await sendNotification({
      user_id: employeeId,
      title: `您的申訴未通過（APL-${appealId}）`,
      content: `您針對訂單 ORD-${shortOrderId}（${vendorName || "—"}）提出的申訴經審核後未通過。\n\n${adminNotes ? `駁回原因：${adminNotes}\n` : ""}若有疑問請聯繫福委會。`,
      token,
    });
  }

  // === 通知商家 ===
  if (vendorId) {
    if (action === "approve") {
      results.vendorNotified = await sendNotification({
        user_id: vendorId, 
        title: `申訴成立通知：訂單 ORD-${shortOrderId}`,
        content: `您有一筆訂單的客訴已由福委會核准成立。\n\n審核結果：申訴成立\n訂單編號：${orderId}\n退款金額：NT$ ${refund}\n違規點數：+1 點\n${adminNotes ? `審核備註：${adminNotes}\n` : ""}目前狀態：approved`,
        token,
      });
    } else {
      results.vendorNotified = await sendNotification({
        user_id: vendorId,
        title: `申訴結案通知：訂單 ORD-${shortOrderId}`,
        content: `針對您訂單的申訴經審核後判定未成立。\n\n審核結果：申訴駁回\n訂單編號：${orderId}\n${adminNotes ? `審核備註：${adminNotes}\n` : ""}目前狀態：rejected\n感謝您的用心服務。`,
        token,
      });
    }
  }

  return NextResponse.json({
    success: true,
    ...results,
  });
}