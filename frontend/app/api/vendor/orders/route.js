// app/api/vendor/orders/route.js
import { NextResponse } from "next/server";
import { MOCK_ORDERS } from "@/lib/mockData";

export async function GET(request) {
  // 1. 取得請求上的 query 參數
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "all";

  // 2. 這裡未來可以實作與真實後端（例如 Java/Go 微服務）的介接，或在此驗證 Token
  // const token = request.headers.get("Authorization");

  // 3. 目前做為假資料或過渡用的回傳點
  // 如果你需要根據 range 篩選假資料，也可以在這裡實作
  const filteredMocks = MOCK_ORDERS; 

  return NextResponse.json({ 
    success: true,
    orders: filteredMocks 
  });
}