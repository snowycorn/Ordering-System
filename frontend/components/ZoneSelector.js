// components/ZoneSelector.js — 廠區選擇器
"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ZONES } from "@/lib/zones";

export default function ZoneSelector({ selected }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function pick(value) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("zone", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="surface-panel rounded-lg p-3">
      <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-[var(--teal-600)]">
        選擇廠區（不同廠區的合作商家不同）
      </p>
      <div className="flex gap-2">
        {ZONES.map((z) => {
          const active = z.value === selected;
          return (
            <button
              key={z.value}
              onClick={() => pick(z.value)}
              className={`flex-1 rounded-md border px-3 py-2.5 text-sm font-bold transition sm:flex-none sm:px-6 ${
                active
                  ? "border-[var(--navy-600)] bg-[var(--navy-600)] text-white"
                  : "border-[var(--line)] bg-white text-[var(--navy-900)] hover:border-[var(--teal-200)]"
              }`}
            >
              {z.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}