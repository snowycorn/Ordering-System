import { NextResponse } from "next/server";
import {
  COOKIE_NAME,
  ENDPOINTS,
  ROLE_COOKIE_NAME,
  SERVICES,
  USE_LOCAL_MOCKS,
  apiFetch,
  authCookieOptions,
  jsonOrEmpty,
  serviceUrl,
} from "@/lib/api";

function createLoginResponse({ token, role, user = null, userId = null, mock = false }) {
  const response = NextResponse.json({
    user,
    role,
    userId,
    mock,
    message: mock ? "本地開發登入成功" : "登入成功",
  });
  const options = authCookieOptions();

  response.cookies.set(COOKIE_NAME, token, options);
  response.cookies.set(ROLE_COOKIE_NAME, role || "employee", options);

  if (userId !== undefined && userId !== null) {
    response.cookies.set("userId", String(userId), options);
  }

  return response;
}

export async function POST(request) {
  const payload = await request.json().catch(() => ({}));
  const email = payload.email || payload.username;
  const selectedRole = payload.selectedRole || "employee";

  if (!email || !payload.password) {
    return NextResponse.json({ message: "請輸入 Email 與密碼" }, { status: 400 });
  }

  try {
    const res = await apiFetch(serviceUrl(SERVICES.iam, ENDPOINTS.iamLogin), {
      method: "POST",
      body: {
        email,
        password: payload.password,
      },
    });
    const data = await jsonOrEmpty(res);

    if (!res.ok) {
      return NextResponse.json(
        { message: data.message || "帳號或密碼錯誤" },
        { status: res.status },
      );
    }

    const token = data.token || data.access_token || data.accessToken || data.jwt;
    const role = data.role || data.user?.role || selectedRole;
    const userId = data.userId || data.user_id || data.user?.id;

    if (!token) {
      return NextResponse.json({ message: "IAM 未回傳 token" }, { status: 502 });
    }

    return createLoginResponse({
      token,
      role,
      user: data.user || { email, role, id: userId },
      userId,
    });
  } catch {
    if (USE_LOCAL_MOCKS) {
      return createLoginResponse({
        token: "fake.jwt.for-local-dev",
        role: selectedRole,
        user: {
          id: 0,
          email,
          role: selectedRole,
        },
        userId: 0,
        mock: true,
      });
    }

    return NextResponse.json({ message: "IAM 服務無法連線" }, { status: 503 });
  }
}
