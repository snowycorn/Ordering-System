// app/api/vendor/menus/[id]/route.js
import { cookies } from "next/headers";
import {
  COOKIE_NAME,
  SERVICES,
  ENDPOINTS,
  apiFetch,
  serviceUrl,
  withPathParams,
} from "@/lib/api";

function buildUrl(id) {
  return serviceUrl(
    SERVICES.vendor,
    withPathParams(ENDPOINTS.vendorMeMenuDetail, { menuId: id }),
  );
}

export async function GET(_req, { params }) {
  const { id } = await params;
  console.log("Fetching menu details for ID:", id);
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const url = buildUrl(id);

  if (!url) return Response.json({ message: "後端服務未設定" }, { status: 503 });

  try {
    const res = await apiFetch(url, { token });
    const data = await res.json().catch(() => ({}));
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ message: "無法連接後端服務" }, { status: 503 });
  }
}

export async function PUT(req, { params }) {
  const { id } = await params;
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  const body  = await req.json().catch(() => ({}));
  const url   = buildUrl(id);

  if (!url) return Response.json({ message: "後端服務未設定" }, { status: 503 });

  try {
    const res  = await apiFetch(url, { token, method: "PUT", body });
    const data = await res.json().catch(() => ({}));
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ message: "無法連接後端服務" }, { status: 503 });
  }
}

export async function DELETE(_req, { params }) {
  const { id } = await params;
  const token  = (await cookies()).get(COOKIE_NAME)?.value;
  const url    = buildUrl(id);

  if (!url) return Response.json({ message: "後端服務未設定" }, { status: 503 });

  try {
    const res = await apiFetch(url, { token, method: "DELETE" });
    // 後端可能回 204 No Content
    if (res.status === 204) return new Response(null, { status: 204 });
    const data = await res.json().catch(() => ({}));
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ message: "無法連接後端服務" }, { status: 503 });
  }
}