import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, ENDPOINTS, SERVICES, apiFetch, jsonOrEmpty, serviceUrl } from "@/lib/api";
import { MOCK_EMPLOYEES } from "@/lib/mockData";

export async function GET() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;

  try {
    const res = await apiFetch(serviceUrl(SERVICES.iam, ENDPOINTS.iamEmployees), { token });
    const data = await jsonOrEmpty(res);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(MOCK_EMPLOYEES);
  }
}

export async function POST(request) {
  const payload = await request.json().catch(() => ({}));
  const token = (await cookies()).get(COOKIE_NAME)?.value;

  try {
    const res = await apiFetch(serviceUrl(SERVICES.iam, ENDPOINTS.iamEmployees), {
      token,
      method: "POST",
      body: payload,
    });
    const data = await jsonOrEmpty(res);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      {
        id: `EMP-DEMO-${Date.now()}`,
        ...payload,
        created_at: new Date().toISOString(),
        mock: true,
      },
      { status: 201 },
    );
  }
}
