// app/api/admin/accounts/route.js — admin 帳號管理 API
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES,
  apiFetch, jsonOrEmpty, serviceUrl,
} from "@/lib/api";

// 撈所有 users + employees，合併成「完整帳號清單」
export async function GET() {
  if (!SERVICES.iam) return NextResponse.json({ message: "IAM 未設定" }, { status: 503 });
  const token = (await cookies()).get(COOKIE_NAME)?.value;

  try {
    const [usersRes, employeesRes] = await Promise.all([
      apiFetch(serviceUrl(SERVICES.iam, ENDPOINTS.iamUsers), { token }),
      apiFetch(serviceUrl(SERVICES.iam, ENDPOINTS.iamEmployees), { token }),
    ]);

    if (!usersRes.ok) {
      return NextResponse.json({ message: "讀取 users 失敗" }, { status: usersRes.status });
    }

    const users = await jsonOrEmpty(usersRes);
    const usersList = Array.isArray(users) ? users : users.users || [];

    let employeesList = [];
    if (employeesRes.ok) {
      const employees = await jsonOrEmpty(employeesRes);
      employeesList = Array.isArray(employees) ? employees : employees.employees || [];
    }

    // 把 employee 資料 merge 到 user 上
    const employeeByUserId = {};
    for (const e of employeesList) {
      employeeByUserId[e.user_id] = e;
    }

    const merged = usersList.map((u) => {
      const emp = employeeByUserId[u.id];
      return {
        id: u.id,
        email: u.email,
        role: u.role,
        created_at: u.created_at,
        last_login_at: u.last_login_at,
        // 員工身份才有的欄位
        full_name: emp?.full_name || null,
        factory_zone: emp?.factory_zone || null,
        phone_number: emp?.phone_number || null,
        employee_id: emp?.id || null,
      };
    });

    return NextResponse.json(merged);
  } catch {
    return NextResponse.json({ message: "服務無法連線" }, { status: 503 });
  }
}

// 建立新帳號（同時建 user 和選擇性建 employee）
export async function POST(request) {
  if (!SERVICES.iam) return NextResponse.json({ message: "IAM 未設定" }, { status: 503 });
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const payload = await request.json().catch(() => ({}));

  const { email, password, role, full_name, factory_zone, phone_number } = payload;

  if (!email || !password || !role) {
    return NextResponse.json({ message: "請填寫 email、password、role" }, { status: 400 });
  }

  try {
    // Step 1: 建 user
    const userRes = await apiFetch(serviceUrl(SERVICES.iam, ENDPOINTS.iamUsers), {
      token,
      method: "POST",
      body: { email, password, role },
    });
    const userData = await jsonOrEmpty(userRes);
    if (!userRes.ok) {
      return NextResponse.json(
        { message: userData.message || "建立帳號失敗" },
        { status: userRes.status }
      );
    }

    // Step 2: 如果是 employee，再建 employee 資料
    if (role === "employee" && (full_name || factory_zone || phone_number)) {
      try {
        await apiFetch(serviceUrl(SERVICES.iam, ENDPOINTS.iamEmployees), {
          token,
          method: "POST",
          body: {
            user_id: userData.id,
            full_name: full_name || "",
            factory_zone: factory_zone || "",
            phone_number: phone_number || "",
          },
        });
      } catch {
        // 員工資料建失敗不擋，帳號還是建好了
      }
    }

    return NextResponse.json(userData, { status: 201 });
  } catch {
    return NextResponse.json({ message: "服務無法連線" }, { status: 503 });
  }
}