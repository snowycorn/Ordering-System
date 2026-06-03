// lib/orderCutoff.js — 訂單取消截止判斷
// 規則：取餐日期前一天 17:00 之前可以取消，之後就不能取消。

export function canCancelOrder(targetDate) {
  if (!targetDate) return true; // 沒指定日期就允許（保險）

  // 取得「截止時刻」= 取餐日期前一天 17:00
  const cutoff = new Date(targetDate);
  cutoff.setDate(cutoff.getDate() - 1);
  cutoff.setHours(17, 0, 0, 0);

  return new Date() < cutoff;
}

// 給使用者看的提示文字
export function cancelDeadlineLabel(targetDate) {
  if (!targetDate) return "";
  const cutoff = new Date(targetDate);
  cutoff.setDate(cutoff.getDate() - 1);
  const m = String(cutoff.getMonth() + 1).padStart(2, "0");
  const d = String(cutoff.getDate()).padStart(2, "0");
  return `${m}/${d} 17:00 前可取消`;
}