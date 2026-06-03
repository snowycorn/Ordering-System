import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, ENDPOINTS, SERVICES, apiFetch, jsonOrEmpty, serviceUrl } from "@/lib/api";
import { MOCK_STATEMENTS } from "@/lib/mockData";



export async function GET() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  try {
    const res = await apiFetch(serviceUrl(SERVICES.billing, ENDPOINTS.billingStatements), {
      token,
    });

    const data = await jsonOrEmpty(res);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(MOCK_STATEMENTS);
  }

}



export async function POST(request) {
  const payload = await request.json().catch(() => ({}));
  const token = (await cookies()).get(COOKIE_NAME)?.value;

  try {
    const res = await apiFetch(serviceUrl(SERVICES.billing, ENDPOINTS.billingStatements), {
      token,
      method: "POST",
      body: payload,
    });

    const data = await jsonOrEmpty(res);
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      {
        id: `STM-DEMO-${Date.now()}`,
        created_at: new Date().toISOString(),
        ...payload,
        mock: true,
      },
      { status: 201 },
    );
  }
}

