// app/api/recommendations/route.js — 個人推薦
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, SERVICES, apiFetch, jsonOrEmpty } from "@/lib/api";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const userId = cookieStore.get("userId")?.value;

  if (!SERVICES.recommendation || !userId) {
    return NextResponse.json({ source: "none", recommendations: [] });
  }

  try {
    const res = await apiFetch(
      `${SERVICES.recommendation}/recommendations/for/${encodeURIComponent(userId)}`,
      { token }
    );
    if (!res.ok) {
      return NextResponse.json({ source: "error", recommendations: [] });
    }
    const data = await jsonOrEmpty(res);

    // 翻譯欄位：price 轉數字、扁平化 vendor 資訊
    const recommendations = (data.recommendations || []).map((r) => ({
      menu_id: r.id,
      name: r.name,
      price: Number(r.price ?? 0),
      image_url: r.imageUrl || null,
      daily_limit: Number(r.dailyLimit ?? 0),
      tags: r.tags || [],
      vendor_id: r.vendorId || r.vendor?.id,
      vendor_name: r.vendor?.name || "",
      vendor_factory_zone: r.vendor?.factoryZone || "",
      score: r.score,
    }));

    return NextResponse.json({
      source: data.source || "live",
      recommendations,
    });
  } catch {
    return NextResponse.json({ source: "error", recommendations: [] });
  }
}