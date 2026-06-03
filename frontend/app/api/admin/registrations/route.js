// app/api/admin/registrations/route.js
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, SERVICES, apiFetch, jsonOrEmpty } from "@/lib/api";

export async function GET(request) {
  if (!SERVICES.vendor) {
    return NextResponse.json({ message: "註冊服務尚未設定" }, { status: 503 });
  }
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status"); // PENDING / APPROVED / REJECTED

  let url = `${SERVICES.vendor}/api/v1/admin/register/applications`;
  if (status) url += `?status=${encodeURIComponent(status)}`;

  try {
    const res = await apiFetch(url, { token });
    const data = await jsonOrEmpty(res);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: "服務無法連線" }, { status: 503 });
  }
}