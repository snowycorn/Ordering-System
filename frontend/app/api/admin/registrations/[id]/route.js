// app/api/admin/registrations/[id]/route.js
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, SERVICES, apiFetch, jsonOrEmpty } from "@/lib/api";

// 看單筆（含 PDF 下載連結）
export async function GET(_req, { params }) {
  const { id } = await params;
  if (!SERVICES.vendor) return NextResponse.json({ message: "服務未設定" }, { status: 503 });
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  try {
    const res = await apiFetch(
      `${SERVICES.vendor}/api/v1/admin/register/applications/${encodeURIComponent(id)}`,
      { token }
    );
    const data = await jsonOrEmpty(res);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: "服務無法連線" }, { status: 503 });
  }
}

// 核准或駁回：用 ?action=approve 或 ?action=reject
export async function POST(request, { params }) {
  const { id } = await params;
  if (!SERVICES.vendor) return NextResponse.json({ message: "服務未設定" }, { status: 503 });
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ message: "action 必須是 approve 或 reject" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));

  try {
    const res = await apiFetch(
      `${SERVICES.vendor}/api/v1/admin/register/applications/${encodeURIComponent(id)}/${action}`,
      { token, method: "POST", body }
    );
    const data = await jsonOrEmpty(res);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: "服務無法連線" }, { status: 503 });
  }
}