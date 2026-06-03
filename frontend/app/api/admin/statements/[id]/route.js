// app/api/admin/statements/[id]/route.js — 刪除帳單
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES,
  apiFetch, jsonOrEmpty, serviceUrl,
} from "@/lib/api";

export async function DELETE(_req, { params }) {
  const { id } = await params;
  if (!SERVICES.billing) return NextResponse.json({ message: "帳單服務未設定" }, { status: 503 });
  const token = (await cookies()).get(COOKIE_NAME)?.value;

  try {
    const res = await apiFetch(
      serviceUrl(SERVICES.billing, `${ENDPOINTS.billingStatements}/${encodeURIComponent(id)}`),
      { token, method: "DELETE" }
    );
    const data = await jsonOrEmpty(res);
    return NextResponse.json(data || { ok: true }, { status: res.status });
  } catch {
    return NextResponse.json({ message: "服務無法連線" }, { status: 503 });
  }
}