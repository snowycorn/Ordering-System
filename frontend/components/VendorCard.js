// components/VendorCard.js — 首頁的商家卡片
import Link from "next/link";

export default function VendorCard({ vendor, query }) {
  const href = `/employee/vendors/${vendor.id}${query ? `?${query}` : ""}`;
  return (
    <Link
      href={href}
      className={`group surface-panel block overflow-hidden rounded-lg transition hover:-translate-y-0.5 hover:border-[var(--teal-200)] hover:shadow-lg ${
        vendor.is_open ? "" : "pointer-events-none opacity-60"
      }`}
    >
      <div className="relative aspect-[16/9] w-full bg-gradient-to-br from-[var(--navy-50)] via-white to-[var(--teal-50)]">
        {vendor.image_url ? (
          <div
            role="img"
            aria-label={vendor.name}
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${vendor.image_url})` }}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="rounded-md border border-[var(--navy-100)] bg-white px-4 py-2 text-center shadow-sm">
              <div className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--navy-600)]">TSMC</div>
              <div className="mt-0.5 text-sm font-semibold text-slate-700">Vendor</div>
            </div>
          </div>
        )}
        {!vendor.is_open && (
          <span className="absolute left-2 top-2 rounded bg-[var(--navy-900)]/80 px-2 py-0.5 text-xs font-bold text-white">
            休息中
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold text-[var(--navy-900)]">{vendor.name}</h3>
          <span className="shrink-0 rounded-full bg-[var(--success-bg)] px-2 py-0.5 text-xs font-bold text-[var(--success-fg)]">
            ★ {vendor.rating}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">{vendor.category}・備餐 {vendor.eta}</p>
        <p className="mt-2 line-clamp-2 text-sm text-slate-600">{vendor.description}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {(vendor.tags || []).slice(0, 3).map((t) => (
            <span key={t} className="rounded-full bg-[var(--navy-50)] px-2.5 py-1 text-xs font-semibold text-[var(--navy-600)]">
              {t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}