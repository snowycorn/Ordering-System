// app/api/profile/route.js — 讀取自己的個人資料
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES,
  apiFetch, jsonOrEmpty, serviceUrl,
} from "@/lib/api";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const userId = cookieStore.get("userId")?.value;

  if (!token || !userId) {
    return NextResponse.json({ message: "未登入" }, { status: 401 });
  }

  try {
    // 平行打 users 和 employees
    const [userRes, empRes] = await Promise.all([
      apiFetch(
        serviceUrl(SERVICES.iam, `${ENDPOINTS.iamUsers}/${encodeURIComponent(userId)}`),
        { token }
      ),
      apiFetch(
        serviceUrl(SERVICES.iam, `${ENDPOINTS.iamEmployees}/user/${encodeURIComponent(userId)}`),
        { token }
      ),
    ]);

    const userData = userRes.ok ? await jsonOrEmpty(userRes) : {};
    const empData = empRes.ok ? await jsonOrEmpty(empRes) : {};

    // 合併兩邊資料
    return NextResponse.json({
      user_id: userData.id || Number(userId),
      email: userData.email || "",
      role: userData.role || "",
      employee_id: empData.id || null,    // 員工編號（employees 表的 id）
      full_name: empData.full_name || "",
      factory_zone: empData.factory_zone || "",
      phone_number: empData.phone_number || "",
    });
  } catch {
    return NextResponse.json({ message: "服務無法連線" }, { status: 503 });
  }
}