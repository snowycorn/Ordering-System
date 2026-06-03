// app/page.js
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(process.env.AUTH_COOKIE_NAME || "token")?.value;
  const role = cookieStore.get("role")?.value;

  // 已登入：依 role 跳對應工作區
  if (token && role) {
    if (role === "admin") redirect("/committee");
    if (role === "vendor") redirect("/vendor");
    redirect("/employee");
  }

  // 沒登入：直接到登入頁
  redirect("/login");
}