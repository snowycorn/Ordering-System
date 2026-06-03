// app/api/register/upload-url/route.js
import { NextResponse } from "next/server";
import { SERVICES, apiFetch, jsonOrEmpty } from "@/lib/api";

export async function GET() {
  if (!SERVICES.vendor) {
    return NextResponse.json({ message: "服務未設定" }, { status: 503 });
  }
  try {
    const res = await apiFetch(
      `${SERVICES.vendor}/api/v1/register/upload-url?contentType=application/pdf`,
      { method: "GET" }
    );
    const data = await jsonOrEmpty(res);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: "服務無法連線" }, { status: 503 });
  }
}