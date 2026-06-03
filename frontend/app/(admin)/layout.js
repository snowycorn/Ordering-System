// app/(admin)/layout.js
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import CommitteeNavbar from "@/components/CommitteeNavbar";

export default async function AdminLayout({ children }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(process.env.AUTH_COOKIE_NAME || "token")?.value;
  const role = cookieStore.get("role")?.value;

  if (!token) redirect("/login");

  // vendor 不能進福委會 → 回商家頁面
  if (role === "vendor") redirect("/vendor");

  // 非 admin（即 employee）→ 回員工頁面
  if (role !== "admin") redirect("/employee");

  return (
    <div className="min-h-screen bg-[var(--neutral-bg)]">
      <CommitteeNavbar />
      <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}