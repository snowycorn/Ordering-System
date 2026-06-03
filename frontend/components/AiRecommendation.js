// components/AiRecommendation.js — AI 推薦餐點（橫向滑動卡片）
"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function AiRecommendation({ zone }) {
  const [items, setItems] = useState(null);
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/recommendations")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setSource(data.source || "");
        setItems(data.recommendations || []);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  // 篩出符合當前廠區的推薦（同廠區優先；不符合的不顯示，避免員工點到訂不到）
  const filtered = (items || []).filter(
    (item) => !item.vendor_factory_zone || item.vendor_factory_zone === `${zone}廠`
  );

  return (
    <section className="rounded-lg border border-[var(--teal-200)] bg-[var(--teal-50)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-black text-[var(--teal-600)]">為你推薦</p>
          <p className="text-xs text-slate-500">
            {source === "live"
              ? "依你的口味與本廠區供應，為你挑選今日值得試試的餐點"
              : "依你的口味與本廠區供應，為你挑選今日值得試試的餐點"}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-slate-500">載入推薦中...</p>
      ) : filtered.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {filtered.map((item) => (
            <Link
              key={item.menu_id}
              href={`/employee/vendors/${item.vendor_id}?zone=${zone}`}
              className="group flex w-[240px] shrink-0 flex-col rounded-lg border border-white bg-white p-3 shadow-sm transition hover:border-[var(--teal-400)] hover:shadow-md"
            >
              {/* 圖片 */}
              <div className="aspect-[5/4] w-full overflow-hidden rounded-md bg-gradient-to-br from-[var(--navy-50)] to-[var(--teal-50)]">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                  />
                ) : (
                  {/*<div className="flex h-full items-center justify-center text-2xl">🍽️</div>*/}
                )}
              </div>

              {/* 文字 */}
              <div className="mt-3">
                <h3 className="line-clamp-1 font-bold text-[var(--navy-900)]">{item.name}</h3>
                <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{item.vendor_name}</p>

                {/* 標籤 */}
                {item.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {item.tags.slice(0, 2).map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-[var(--teal-50)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--teal-600)]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between">
                  <span className="font-black text-[var(--navy-600)]">${item.price}</span>
                  <span className="text-xs text-slate-500">每日限量 {item.daily_limit}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="rounded-md bg-white py-6 text-center text-sm text-slate-500">
          {items === null
            ? "推薦服務無法連線"
            : `${zone} 廠區暫無推薦餐點`}
        </p>
      )}
    </section>
  );
}