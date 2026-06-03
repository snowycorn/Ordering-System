// app/(vendor)/layout.js
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import VendorNavbar from "@/components/VendorNavbar";

export default async function VendorLayout({ children }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(process.env.AUTH_COOKIE_NAME || "token")?.value;
  const role = cookieStore.get("role")?.value;

  if (!token) redirect("/login");

  if (role !== "vendor" && role !== "admin") {
    redirect("/employee");
  }

  return (
    <div className="min-h-screen bg-[var(--neutral-bg)]">
      <VendorNavbar />
      <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}