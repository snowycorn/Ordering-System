// app/api/admin/vendors/[id]/route.js — admin 管理商家
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, SERVICES, apiFetch, jsonOrEmpty } from "@/lib/api";

// 看單一商家
export async function GET(_req, { params }) {
  const { id } = await params;
  if (!SERVICES.vendor) return NextResponse.json({ message: "服務未設定" }, { status: 503 });
  const token = (await cookies()).get(COOKIE_NAME)?.value;

  try {
    const res = await apiFetch(
      `${SERVICES.vendor}/api/v1/admin/vendors/${encodeURIComponent(id)}`,
      { token }
    );
    const data = await jsonOrEmpty(res);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: "服務無法連線" }, { status: 503 });
  }
}

// 更新商家（修改名稱、廠區、狀態）
export async function PUT(request, { params }) {
  const { id } = await params;
  if (!SERVICES.vendor) return NextResponse.json({ message: "服務未設定" }, { status: 503 });
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const body = await request.json().catch(() => ({}));

  try {
    const res = await apiFetch(
      `${SERVICES.vendor}/api/v1/admin/vendors/${encodeURIComponent(id)}`,
      { token, method: "PUT", body }
    );
    const data = await jsonOrEmpty(res);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: "服務無法連線" }, { status: 503 });
  }
}

// 違規扣分 + 停權 + 復權，用 ?action= 區分
export async function POST(request, { params }) {
  const { id } = await params;
  if (!SERVICES.vendor) return NextResponse.json({ message: "服務未設定" }, { status: 503 });
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");
  const body = await request.json().catch(() => ({}));

  let path;
  if (action === "violation") path = `/api/v1/admin/vendors/${encodeURIComponent(id)}/violation-points`;
  else if (action === "suspend") path = `/api/v1/admin/vendors/${encodeURIComponent(id)}/suspend`;
  else if (action === "reactivate") path = `/api/v1/admin/vendors/${encodeURIComponent(id)}/reactivate`;
  else return NextResponse.json({ message: "action 必須是 violation / suspend / reactivate" }, { status: 400 });

  try {
    const res = await apiFetch(`${SERVICES.vendor}${path}`, {
      token,
      method: "POST",
      body,
    });
    const data = await jsonOrEmpty(res);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: "服務無法連線" }, { status: 503 });
  }
}