// app/(main)/profile/page.js — 員工個人資料
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES,
  apiFetch, jsonOrEmpty, serviceUrl,
} from "@/lib/api";
import ProfilePanel from "@/components/ProfilePanel";

export const dynamic = "force-dynamic";

async function getProfile() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  const userId = cookieStore.get("userId")?.value;

  if (!token || !userId) return null;

  try {
    const [userRes, empRes] = await Promise.all([
      apiFetch(
        serviceUrl(SERVICES.iam, `${ENDPOINTS.iamUsers}/${encodeURIComponent(userId)}`),
        { token }
      ),
      apiFetch(
        serviceUrl(SERVICES.iam, `${ENDPOINTS.iamEmployees}/user/${encodeURIComponent(userId)}`),
        { token }
      ),
    ]);

    const userData = userRes.ok ? await jsonOrEmpty(userRes) : {};
    const empData = empRes.ok ? await jsonOrEmpty(empRes) : {};

    return {
      user_id: userData.id || Number(userId),
      email: userData.email || "",
      role: userData.role || "",
      employee_id: empData.id || null,
      full_name: empData.full_name || "",
      factory_zone: empData.factory_zone || "",
      phone_number: empData.phone_number || "",
    };
  } catch {
    return null;
  }
}

export default async function ProfilePage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <section className="surface-panel rounded-lg p-5 sm:p-6">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[var(--teal-600)]">My Profile</p>
        <h1 className="mt-2 text-3xl font-black text-[var(--navy-900)]">個人資料</h1>
        <p className="mt-1 text-sm text-slate-500">管理你的帳號資訊，僅 Email、電話與密碼可修改</p>
      </section>

      <ProfilePanel profile={profile} />
    </div>
  );
}