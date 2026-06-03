// app/api/vendor/menus/upload-image-url/route.js
// 代理：取得 S3 Pre-signed Upload URL
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, SERVICES, apiFetch, serviceUrl } from "@/lib/api";

export async function GET(request) {
  const token       = (await cookies()).get(COOKIE_NAME)?.value;
  const contentType = new URL(request.url).searchParams.get("contentType") || "image/jpeg";

  if (!token) {
    return NextResponse.json({ message: "未登入" }, { status: 401 });
  }

  // 後端還沒好時回傳 mock，讓前端不會卡住
  if (!SERVICES.vendor) {
    console.warn("[upload-image-url] VENDOR_URL 未設定，回傳 mock URL");
    const fakeKey = `mock-${Date.now()}.jpg`;
    return NextResponse.json({
      uploadUrl: `https://mock-s3.example.com/${fakeKey}?mock=true`,
      imageUrl:  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&auto=format&fit=crop",
      expiresIn: 300,
    });
  }

  try {
    const backendUrl = serviceUrl(SERVICES.vendor, "/api/v1/vendors/me/menus/upload-image-url");
    const res        = await apiFetch(
      `${backendUrl}?contentType=${encodeURIComponent(contentType)}`,
      { token }
    );

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(
        { message: data.message || "無法取得上傳授權網址" },
        { status: res.status }
      );
    }

    const data = await res.json();
    // 回傳後端給的 { uploadUrl, imageUrl, expiresIn }
    return NextResponse.json(data);
  } catch (err) {
    console.error("[upload-image-url]", err);
    return NextResponse.json({ message: "伺服器錯誤，請稍後再試" }, { status: 500 });
  }
}