// app/api/vendor/menus/route.js
// 代理：新增菜單 POST /api/v1/vendors/me/menus
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, SERVICES, apiFetch, serviceUrl } from "@/lib/api";

export async function POST(request) {
  const token   = (await cookies()).get(COOKIE_NAME)?.value;
  const payload = await request.json().catch(() => ({}));

  if (!token) {
    return NextResponse.json({ message: "未登入" }, { status: 401 });
  }

  // 後端還沒好時 mock 成功，讓前端可以繼續開發
  if (!SERVICES.vendor) {
    console.warn("[api/vendor/menus] VENDOR_URL 未設定，回傳 mock 成功");
    return NextResponse.json(
      { id: `mock-${Date.now()}`, ...payload },
      { status: 201 }
    );
  }

  try {
    const res = await apiFetch(
      serviceUrl(SERVICES.vendor, "/api/v1/vendors/me/menus"),
      { method: "POST", token, body: payload }
    );

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(
        { message: data.message || "新增餐點失敗" },
        { status: res.status }
      );
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err) {
    console.error("[api/vendor/menus POST]", err);
    return NextResponse.json({ message: "伺服器錯誤，請稍後再試" }, { status: 500 });
  }
}