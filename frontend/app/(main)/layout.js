// app/(main)/layout.js
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";

export default async function MainLayout({ children }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(process.env.AUTH_COOKIE_NAME || "token")?.value;
  const role = cookieStore.get("role")?.value;

  if (!token) redirect("/login");

  // vendor 不該進員工/福委會頁面，跳商家畫面
  // 現在 /vendor 不在 (main) 下，所以這個 redirect 不會迴圈
  if (role === "vendor") redirect("/vendor");

  return (
    <div className="min-h-screen bg-[var(--neutral-bg)]">
      <Navbar />
      <main className="w-full px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}