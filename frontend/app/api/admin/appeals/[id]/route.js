// app/api/admin/appeals/[id]/route.js — admin 審核申訴
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES,
  apiFetch, jsonOrEmpty, serviceUrl,
} from "@/lib/api";

// admin 取得單筆申訴（從 /appeals 列表撈出來找對應的 id）
export async function GET(_req, { params }) {
  const { id } = await params;
  if (!SERVICES.appeal) return NextResponse.json({ message: "服務未設定" }, { status: 503 });
  const token = (await cookies()).get(COOKIE_NAME)?.value;

  try {
    const res = await apiFetch(serviceUrl(SERVICES.appeal, ENDPOINTS.appeals), { token });
    if (!res.ok) return NextResponse.json({ message: "讀取失敗" }, { status: res.status });
    const data = await jsonOrEmpty(res);
    const list = Array.isArray(data) ? data : data.appeals || [];
    const found = list.find((a) => String(a.id) === String(id));
    return found
      ? NextResponse.json(found)
      : NextResponse.json({ message: "找不到申訴" }, { status: 404 });
  } catch {
    return NextResponse.json({ message: "服務無法連線" }, { status: 503 });
  }
}

// admin 審核：PATCH /appeals/:id
export async function PATCH(request, { params }) {
  const { id } = await params;
  if (!SERVICES.appeal) return NextResponse.json({ message: "服務未設定" }, { status: 503 });
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const body = await request.json().catch(() => ({}));

  try {
    const res = await apiFetch(
      serviceUrl(SERVICES.appeal, `${ENDPOINTS.appeals}/${encodeURIComponent(id)}`),
      { token, method: "PATCH", body }
    );
    const data = await jsonOrEmpty(res);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: "服務無法連線" }, { status: 503 });
  }
}