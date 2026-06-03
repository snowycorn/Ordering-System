// app/(admin)/committee/billing/page.js — 福委會帳單管理
import { cookies } from "next/headers";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES,
  apiFetch, jsonOrEmpty, serviceUrl,
} from "@/lib/api";
import BillingDashboard from "@/components/BillingDashboard";

export const dynamic = "force-dynamic";

async function getStatements() {
  if (!SERVICES.billing) return [];
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  try {
    const res = await apiFetch(serviceUrl(SERVICES.billing, ENDPOINTS.billingStatements), { token });
    if (!res.ok) return [];
    const data = await jsonOrEmpty(res);
    return Array.isArray(data) ? data : data.statements || [];
  } catch {
    return [];
  }
}

// 撈所有商家 + 每個商家的 userId（透過 admin endpoint）
async function getVendorsWithUserId() {
  if (!SERVICES.vendor) return [];
  const token = (await cookies()).get(COOKIE_NAME)?.value;

  try {
    // 1. 先拿商家列表（公開 endpoint）
    const listRes = await apiFetch(serviceUrl(SERVICES.vendor, ENDPOINTS.vendors), { token });
    if (!listRes.ok) return [];
    const data = await jsonOrEmpty(listRes);
    const list = Array.isArray(data) ? data : data.vendors || [];

    // 2. 平行打每個商家的 admin endpoint 拿 userId
    const detailed = await Promise.all(
      list.map(async (v) => {
        try {
          const detailRes = await apiFetch(
            `${SERVICES.vendor}/api/v1/admin/vendors/${v.id}`,
            { token }
          );
          if (!detailRes.ok) return v;
          const detail = await jsonOrEmpty(detailRes);
          return {
            ...v,
            userId: detail.userId ?? detail.user_id ?? null,
          };
        } catch {
          return v;
        }
      })
    );

    return detailed;
  } catch {
    return [];
  }
}

export default async function BillingPage() {
  const [statements, vendors] = await Promise.all([
    getStatements(),
    getVendorsWithUserId(),
  ]);
  return <BillingDashboard statements={statements} vendors={vendors} />;
}