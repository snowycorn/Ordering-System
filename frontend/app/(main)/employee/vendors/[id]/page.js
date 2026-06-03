// app/(main)/employee/vendors/[id]/page.js
import Link from "next/link";
import { cookies } from "next/headers";
import {
  COOKIE_NAME, ENDPOINTS, SERVICES, USE_LOCAL_MOCKS,
  apiFetch, jsonOrEmpty, serviceUrl, withPathParams,
} from "@/lib/api";
import { getMockVendor, getMockMenusByVendor } from "@/lib/mockData";
import { ZONES, isValidZone, zoneLabel } from "@/lib/zones";
import VendorOrdering from "@/components/VendorOrdering";

async function getVendorData(id) {
  if (USE_LOCAL_MOCKS || !SERVICES.vendor) {
    return { vendor: getMockVendor(id), menus: getMockMenusByVendor(id) };
  }
  const token = (await cookies()).get(COOKIE_NAME)?.value;

  try {
    // 兩個 API 平行打
    const [vRes, mRes] = await Promise.all([
      apiFetch(serviceUrl(SERVICES.vendor, withPathParams(ENDPOINTS.vendorById, { id })), { token }),
      apiFetch(serviceUrl(SERVICES.vendor, withPathParams(ENDPOINTS.vendorMenus, { id })), { token }),
    ]);

    // 商家資訊
    let vendor = null;
    if (vRes.ok) vendor = await jsonOrEmpty(vRes);

    // 菜單
    let menusRaw = [];
    if (mRes.ok) {
      const md = await jsonOrEmpty(mRes);
      menusRaw = Array.isArray(md) ? md : md.menus || [];
    }

    // 商家詳情 API 失敗時，從 /api/v1/menus 反查（裡面有附 vendor）
    if (!vendor) {
      try {
        const allMenusRes = await apiFetch(
          serviceUrl(SERVICES.vendor, ENDPOINTS.menus) + `?vendorId=${encodeURIComponent(id)}`,
          { token }
        );
        if (allMenusRes.ok) {
          const allMenus = await jsonOrEmpty(allMenusRes);
          const first = Array.isArray(allMenus) ? allMenus[0] : null;
          if (first?.vendor) vendor = first.vendor;
        }
      } catch {}
    }
    if (!vendor) vendor = { id, name: "商家", category: "" };

    const menus = menusRaw.map((m) => ({
      id: m.id,
      vendor_id: m.vendorId || id,
      vendor_name: vendor?.name || "",
      name: m.name,
      price: Number(m.price ?? 0),                                       // 字串轉數字
      daily_limit: Number(m.todayMaxQuantity ?? m.dailyLimit ?? 0),      // 優先看當日配額
      category: m.category || "",
      tags: m.tags || [],
      image_url: m.imageUrl || null,
      is_active: m.isActive !== false,
    })).filter(m => m.is_active); // 只顯示上架的

    console.log("Fetched vendor data:", { vendor, menus });
    let imageUrl = vendor.imageUrl || vendor.image_url || vendor.image || null;

    // Fallback：若單一端點沒有回傳圖片，從列表撈
    if (!imageUrl) {
      try {
        const listRes = await apiFetch(serviceUrl(SERVICES.vendor, ENDPOINTS.vendors), { token });
        if (listRes.ok) {
          const list = await jsonOrEmpty(listRes);
          const found = (Array.isArray(list) ? list : list.vendors ?? []).find((v) => v.id === id);
          if (found) imageUrl = found.imageUrl || found.image_url || null;
        }
      } catch {}
    }

    const vendorMapped = {
      id: vendor.id || id,
      name: vendor.name,
      category: vendor.category || "",
      rating: vendor.rating ?? 4.5,
      eta: vendor.eta || "—",
      description: vendor.description || "",
      image_url: imageUrl,
      zones: vendor.allowedAreas || (vendor.factoryZone ? [vendor.factoryZone] : []),
      is_open: vendor.status ? vendor.status === "ACTIVE" : true,
    };

    return { vendor: vendorMapped, menus };
  } catch {
    return { vendor: getMockVendor(id), menus: getMockMenusByVendor(id) };
  }
}

export default async function VendorDetailPage({ params, searchParams }) {
  const { id } = await params;
  const sp = await searchParams;

  const zone = isValidZone(sp?.zone) ? sp.zone : ZONES[0].value;
  const backQuery = new URLSearchParams({ zone, ...(sp?.q ? { q: sp.q } : {}) }).toString();

  const { vendor, menus } = await getVendorData(id);

  if (!vendor) {
    return (
      <div className="surface-panel mx-auto max-w-[1440px] rounded-lg p-8 text-center">
        <p className="text-sm text-slate-500">找不到這間商家。</p>
        <Link href={`/employee?${backQuery}`} className="mt-3 inline-block text-sm font-bold text-[var(--navy-600)]">
          ← 回商家列表
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-5">
      <Link
        href={`/employee?${backQuery}`}
        className="inline-flex items-center gap-1 text-sm font-bold text-slate-500 transition hover:text-[var(--navy-600)]"
      >
        ← 回商家列表
      </Link>

      <section className="surface-panel overflow-hidden rounded-lg">
        <div className="aspect-[21/9] w-full overflow-hidden bg-gradient-to-br from-[var(--navy-50)] via-white to-[var(--teal-50)]">
          {vendor.image_url ? (
            <img src={vendor.image_url} alt={vendor.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-xs font-bold uppercase tracking-[0.3em] text-[var(--navy-600)]">TSMC Vendor</span>
            </div>
          )}
        </div>
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-black text-[var(--navy-900)]">{vendor.name}</h1>
            <span className="rounded-full bg-[var(--success-bg)] px-2 py-0.5 text-xs font-bold text-[var(--success-fg)]">★ {vendor.rating}</span>
            <span className="rounded-full bg-[var(--navy-50)] px-2 py-0.5 text-xs font-bold text-[var(--navy-600)]">{zoneLabel(zone)}廠區</span>
          </div>
          <p className="mt-1 text-sm text-slate-500">{vendor.category}{vendor.eta ? `・備餐 ${vendor.eta}` : ""}</p>
          {vendor.description && <p className="mt-2 max-w-2xl text-sm text-slate-600">{vendor.description}</p>}
        </div>
      </section>

      <VendorOrdering vendor={vendor} menus={menus} zone={zone} />
    </div>
  );
}