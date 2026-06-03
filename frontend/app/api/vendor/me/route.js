import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME, SERVICES, ENDPOINTS, apiFetch, serviceUrl } from "@/lib/api";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.json({ error: "未登入" }, { status: 401 });
    }

    const url = serviceUrl(SERVICES.vendor, ENDPOINTS.vendorMe ?? "/api/v1/vendors/me");

    const res = await apiFetch(url, { token });
    
    if (!res.ok) {
      return NextResponse.json({ error: "無法獲取商家資訊" }, { status: res.status });
    }

    const data = await res.json();

    return NextResponse.json(data);
    
  } catch (error) {
    console.error("取得商家資料發生錯誤:", error);
    return NextResponse.json({ error: "伺服器內部錯誤" }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return NextResponse.json({ error: "未登入" }, { status: 401 });

    const body = await request.json();
    const url = serviceUrl(SERVICES.vendor, ENDPOINTS.vendorMe ?? "/api/v1/vendors/me");

    const res = await apiFetch(url, { token, method: "PUT", body });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data);
  } catch (error) {
    console.error("更新商家資料發生錯誤:", error);
    return NextResponse.json({ error: "伺服器內部錯誤" }, { status: 500 });
  }
}