// app/api/auth/me/route.js
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, ENDPOINTS, SERVICES, apiFetch, jsonOrEmpty, serviceUrl, withPathParams } from "@/lib/api";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const userId = cookieStore.get("userId")?.value;
  const role = cookieStore.get("role")?.value;

  if (!token || !userId) {
    return NextResponse.json({ message: "未登入" }, { status: 401 });
  }

  // 試著拿 employee 詳細資料（有 full_name、factory_zone）
  let employee = null;
  if (SERVICES.iam) {
    try {
      const res = await apiFetch(
        serviceUrl(SERVICES.iam, withPathParams(ENDPOINTS.iamEmployeeByUser, { id: userId })),
        { token }
      );
      if (res.ok) employee = await jsonOrEmpty(res);
    } catch {}
  }

  return NextResponse.json({
    userId: Number(userId),
    role,
    email: employee?.email || null,
    full_name: employee?.full_name || null,
    factory_zone: employee?.factory_zone || null,
  });
}