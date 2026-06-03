// lib/zones.js — 廠區清單（A/B/C 區）
// 內部 value 用 A/B/C（單純字母，後端傳送用）
// label 顯示「A 廠」「B 廠」「C 廠」
export const ZONES = [
  { value: "A", label: "A 廠" },
  { value: "B", label: "B 廠" },
  { value: "C", label: "C 廠" },
];

export function isValidZone(value) {
  return ZONES.some((z) => z.value === value);
}

export function zoneLabel(value) {
  return ZONES.find((z) => z.value === value)?.label || value || "";
}

// 後端商家服務 factoryZone 可能存「A」或「A 區」或「A區」
// 這個 helper 統一把 A → A 給後端；如果之後發現後端要中文，改這裡一處即可
export function toBackendZone(value) {
  return `${value}廠`; // A → A廠
}