// app/(vendor)/vendor/profile/page.js — 商家個人資料
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES,
  apiFetch, jsonOrEmpty, serviceUrl,
} from "@/lib/api";
import VendorProfilePanel from "@/components/VendorProfilePanel";

export const dynamic = "force-dynamic";

async function getProfile() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const userId = cookieStore.get("userId")?.value;

  if (!token || !userId) return null;

  try {
    const [userRes, vendorRes] = await Promise.all([
      apiFetch(
        serviceUrl(SERVICES.iam, `${ENDPOINTS.iamUsers}/${encodeURIComponent(userId)}`),
        { token }
      ),
      apiFetch(
        serviceUrl(SERVICES.vendor, ENDPOINTS.vendorMe),
        { token }
      ),
    ]);

    const userData = userRes.ok ? await jsonOrEmpty(userRes) : {};
    const vendorData = vendorRes.ok ? await jsonOrEmpty(vendorRes) : {};
    return {
      user_id: userData.id || Number(userId),
      email: userData.email || "",
      role: userData.role || "",
      vendor_id: vendorData.id || null,
      name: vendorData.name || "",
      category: vendorData.category || "",
      phone_number: vendorData.phone_number || vendorData.phone || "",
      description: vendorData.description || "",
      factory_zones: Array.isArray(vendorData.factoryZones) ? vendorData.factoryZones : [],
      image_url: vendorData.imageUrl || vendorData.image_url || "",
    };
  } catch {
    return null;
  }
}

export default async function VendorProfilePage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <section className="surface-panel rounded-lg p-5 sm:p-6">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--teal-600)]">My Profile</p>
        <h1 className="mt-2 text-3xl font-black text-[var(--navy-900)]">商家資料</h1>
        <p className="mt-1 text-sm text-slate-500">管理你的商家帳號資訊，僅 Email、電話、簡介與密碼可修改</p>
      </section>

      <VendorProfilePanel profile={profile} />
    </div>
  );
}
