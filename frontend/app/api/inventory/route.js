// app/api/inventory/route.js
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { COOKIE_NAME, SERVICES, apiFetch } from "@/lib/api";

export async function POST(request) {
  if (!SERVICES.order) return NextResponse.json({ inventory: {} });
  const { menuIds, date } = await request.json();
  if (!Array.isArray(menuIds) || !date) {
    return NextResponse.json({ inventory: {} });
  }
  const token = (await cookies()).get(COOKIE_NAME)?.value;

  const results = await Promise.all(
    menuIds.map(async (menuId) => {
      try {
        const res = await apiFetch(
          `${SERVICES.order}/inventory/${encodeURIComponent(menuId)}?target_date=${date}`,
          { token }
        );
        if (!res.ok) return [menuId, null];
        const data = await res.json();
        // ★ debug：第一筆印出來看格式
        if (menuId === menuIds[0]) {
          console.log("inventory 後端回的格式:", JSON.stringify(data));
        }
        // 兼容多種可能欄位名
        const remaining = data.remaining ?? data.quantity ?? data.remaining_quantity ?? data;
        return [menuId, typeof remaining === "number" ? remaining : null];
      } catch {
        return [menuId, null];
      }
    })
  );

  const inventory = {};
  for (const [id, qty] of results) inventory[id] = qty;
  return NextResponse.json({ inventory });
}