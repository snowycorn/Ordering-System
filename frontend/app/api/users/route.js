import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, ENDPOINTS, SERVICES, apiFetch, jsonOrEmpty, serviceUrl } from "@/lib/api";
import { MOCK_USERS } from "@/lib/mockData";

export async function GET() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;

  try {
    const res = await apiFetch(serviceUrl(SERVICES.iam, ENDPOINTS.iamUsers), { token });
    const data = await jsonOrEmpty(res);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(MOCK_USERS);
  }
}

export async function POST(request) {
  const payload = await request.json().catch(() => ({}));

  try {
    const res = await apiFetch(serviceUrl(SERVICES.iam, ENDPOINTS.iamUsers), {
      method: "POST",
      body: payload,
    });
    const data = await jsonOrEmpty(res);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      {
        id: `USR-DEMO-${Date.now()}`,
        ...payload,
        password: undefined,
        created_at: new Date().toISOString(),
        mock: true,
      },
      { status: 201 },
    );
  }
}
