// app/api/register/applications/route.js
import { NextResponse } from "next/server";
import { SERVICES, apiFetch, jsonOrEmpty } from "@/lib/api";

export async function POST(request) {
  if (!SERVICES.vendor) {
    return NextResponse.json({ message: "服務未設定" }, { status: 503 });
  }
  const body = await request.json().catch(() => ({}));

  try {
    const res = await apiFetch(
      `${SERVICES.vendor}/api/v1/register/applications`,
      { method: "POST", body }
    );
    const data = await jsonOrEmpty(res);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: "服務無法連線" }, { status: 503 });
  }
}