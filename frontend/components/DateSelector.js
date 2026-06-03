// components/DateSelector.js
"use client";

export default function DateSelector({ days, selected, onChange }) {
  function toggle(value, disabled) {
    if (disabled) return;  // 點不動
    if (selected.includes(value)) {
      onChange(selected.filter((d) => d !== value));
    } else {
      onChange([...selected, value]);
    }
  }

  return (
    <section className="surface-panel rounded-lg p-4">
      <p className="mb-3 text-sm font-bold text-[var(--navy-600)]">
        選擇取餐日期（可多選未來一週內任意天）
      </p>
      <div className="flex flex-wrap gap-2">
        {days.map((d) => {
          const isSelected = selected.includes(d.value);
          const isDisabled = d.disabled;
          return (
            <button
              key={d.value}
              type="button"
              onClick={() => toggle(d.value, isDisabled)}
              disabled={isDisabled}
              title={d.disabledReason || ""}
              className={`min-h-11 rounded-md border px-4 text-sm font-bold transition ${
                isDisabled
                  ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 line-through"
                  : isSelected
                    ? "border-[var(--navy-600)] bg-[var(--navy-600)] text-white"
                    : "border-[var(--line)] bg-white text-slate-600 hover:border-[var(--navy-400)]"
              }`}
            >
              {d.label}
              {/* {isDisabled && <span className="ml-1 text-xs">🚫</span>} */}
            </button>
          );
        })}
      </div>
      {/* 截止時間提示 */}
      <p className="mt-3 text-xs text-slate-500">
        每日 17:00 為截止時間，過後當日不再開放訂購明日餐點
      </p>
    </section>
  );
}