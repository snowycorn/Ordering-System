// app/api/profile/phone/route.js
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES,
  apiFetch, jsonOrEmpty, serviceUrl,
} from "@/lib/api";

export async function PATCH(request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const userId = cookieStore.get("userId")?.value;
  const body = await request.json();

  try {
    const res = await apiFetch(
      serviceUrl(SERVICES.iam, `${ENDPOINTS.iamEmployees}/user/${encodeURIComponent(userId)}/phone`),
      { token, method: "PATCH", body }
    );
    const data = await jsonOrEmpty(res);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: "服務無法連線" }, { status: 503 });
  }
}