// app/api/admin/registrations/send-email/route.js — 寄核准 / 駁回信
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, SERVICES, apiFetch, jsonOrEmpty } from "@/lib/api";

export async function POST(request) {
  if (!SERVICES.iam) {
    return NextResponse.json({ message: "IAM 服務未設定" }, { status: 503 });
  }
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const payload = await request.json().catch(() => ({}));
  const { action, email, account, password, reason } = payload;

  if (!action || !email) {
    return NextResponse.json({ message: "action 和 email 都必填" }, { status: 400 });
  }

  let path;
  let body;
  if (action === "approve") {
    if (!account || !password) {
      return NextResponse.json({ message: "核准信需要 account 和 password" }, { status: 400 });
    }
    path = "/apply/send-approval";
    body = { email, account, password };
  } else if (action === "reject") {
    path = "/apply/send-rejection";
    body = { email, reason: reason || "未提供理由" };
  } else {
    return NextResponse.json({ message: "action 必須是 approve 或 reject" }, { status: 400 });
  }

  try {
    const res = await apiFetch(`${SERVICES.iam}${path}`, {
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