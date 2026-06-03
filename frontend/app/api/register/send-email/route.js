// app/api/register/send-email/route.js — 寄驗證碼 BFF (外部商家用)
import { NextResponse } from "next/server";
import { SERVICES, apiFetch, jsonOrEmpty } from "@/lib/api";

export async function POST(request) {
  if (!SERVICES.iam) {
    return NextResponse.json({ message: "IAM 服務未設定" }, { status: 503 });
  }

  const { email, code } = await request.json().catch(() => ({}));
  if (!email || !code) {
    return NextResponse.json({ message: "email 和 code 都必填" }, { status: 400 });
  }

  try {
    const res = await apiFetch(`${SERVICES.iam}/apply/send-code`, {
      method: "POST",
      body: { email, code: Number(code) },
    });
    const data = await jsonOrEmpty(res);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ message: "服務無法連線" }, { status: 503 });
  }
}