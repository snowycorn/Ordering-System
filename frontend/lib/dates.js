// lib/dates.js — 取餐日期工具

/**
 * 取得未來可選的取餐日期
 * 規則:
 * - 每天 17:00 為訂單截止時間
 * - 17:00 前：明天 (D+1) 可訂
 * - 17:00 後：明天 (D+1) 已截止，標記 disabled
 *
 * @param {number} maxOffset 顯示到第幾天，預設 6 對齊後端庫存 D+0~D+6
 * @returns {Array<{value, label, disabled, disabledReason}>}
 */
export function getNextDays(maxOffset = 7) {
  const days = [];
  const now = new Date();
  const hour = now.getHours();
  const tomorrowDisabled = hour >= 17;  // 17:00 後明天不能訂

  for (let i = 1; i <= maxOffset; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    // 用本地時區
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const value = `${y}-${m}-${day}`;
    const weekday = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
    const label = `${d.getMonth() + 1}/${d.getDate()} (${weekday})`;

    // 只有「明天 (D+1)」且現在過 17:00 才 disabled
    const disabled = i === 1 && tomorrowDisabled;
    const disabledReason = disabled ? "已過 17:00 截止，明日訂單已關閉" : "";

    days.push({ value, label, disabled, disabledReason });
  }
  return days;
}

export function isValidDate(value) {
  if (!value) return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}