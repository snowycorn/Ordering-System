// lib/mockData.js
export const MOCK_VENDORS = [
  { id: 1, name: "藍芯便當", category: "便當", rating: 4.6, eta: "10-15 分", description: "招牌炸物便當，份量飽足。", tags: ["人氣", "便當"], image_url: null, is_open: true, zones: ["A", "B"] },
  { id: 2, name: "綠能輕食", category: "健康餐", rating: 4.8, eta: "5-10 分", description: "低脂舒肥餐盒，營養均衡。", tags: ["健康", "低脂"], image_url: null, is_open: true, zones: ["B", "C"] },
  { id: 3, name: "泰式小館", category: "異國料理", rating: 4.5, eta: "15-20 分", description: "道地泰式風味，椒麻雞人氣高。", tags: ["泰式", "微辣"], image_url: null, is_open: true, zones: ["A"] },
  { id: 4, name: "廠區熱食站", category: "熱食", rating: 4.4, eta: "10-15 分", description: "現炒熱食，暖胃飽足。", tags: ["熱食"], image_url: null, is_open: true, zones: ["A", "B", "C"] },
  { id: 5, name: "晶彩蔬食", category: "素食", rating: 4.3, eta: "10 分", description: "蛋奶素餐點，清爽無負擔。", tags: ["蔬食"], image_url: null, is_open: true, zones: ["C"] },
  { id: 6, name: "海線食堂", category: "日式", rating: 4.7, eta: "15-20 分", description: "新鮮魚料與定食。", tags: ["日式", "魚類"], image_url: null, is_open: false, zones: ["B"] },
];

export const MOCK_MENUS = [
  // 藍芯便當 (1)
  { id: 101, vendor_id: 1, vendor_name: "藍芯便當", name: "日式唐揚雞便當", price: 105, daily_limit: 18, category: "便當", calories: 720, tags: ["人氣", "高蛋白"], image_url: null, ai_score: 94 },
  { id: 107, vendor_id: 1, vendor_name: "藍芯便當", name: "招牌排骨便當", price: 100, daily_limit: 12, category: "便當", calories: 760, tags: ["炸物"], image_url: null, ai_score: 89 },
  // 綠能輕食 (2)
  { id: 102, vendor_id: 2, vendor_name: "綠能輕食", name: "藜麥舒肥雞餐盒", price: 125, daily_limit: 9, category: "健康餐", calories: 560, tags: ["低脂", "蔬食均衡"], image_url: null, ai_score: 97 },
  { id: 108, vendor_id: 2, vendor_name: "綠能輕食", name: "凱薩雞肉沙拉", price: 115, daily_limit: 8, category: "健康餐", calories: 480, tags: ["沙拉"], image_url: null, ai_score: 90 },
  // 泰式小館 (3)
  { id: 103, vendor_id: 3, vendor_name: "泰式小館", name: "椒麻雞腿飯", price: 110, daily_limit: 0, category: "便當", calories: 780, tags: ["微辣"], image_url: null, ai_score: 88 },
  { id: 109, vendor_id: 3, vendor_name: "泰式小館", name: "打拋豬肉飯", price: 105, daily_limit: 14, category: "異國料理", calories: 740, tags: ["微辣"], image_url: null, ai_score: 86 },
  // 廠區熱食站 (4)
  { id: 104, vendor_id: 4, vendor_name: "廠區熱食站", name: "番茄牛肉燴飯", price: 115, daily_limit: 14, category: "熱食", calories: 690, tags: ["熱食", "飽足"], image_url: null, ai_score: 91 },
  { id: 110, vendor_id: 4, vendor_name: "廠區熱食站", name: "黑胡椒豬排飯", price: 110, daily_limit: 16, category: "熱食", calories: 720, tags: ["熱食"], image_url: null, ai_score: 85 },
  // 晶彩蔬食 (5)
  { id: 105, vendor_id: 5, vendor_name: "晶彩蔬食", name: "菇菇蔬菜咖哩", price: 100, daily_limit: 11, category: "素食", calories: 610, tags: ["蛋奶素"], image_url: null, ai_score: 92 },
  { id: 111, vendor_id: 5, vendor_name: "晶彩蔬食", name: "三杯杏鮑菇飯", price: 95, daily_limit: 10, category: "素食", calories: 580, tags: ["蛋奶素"], image_url: null, ai_score: 87 },
  // 海線食堂 (6)
  { id: 106, vendor_id: 6, vendor_name: "海線食堂", name: "鮭魚味噌湯套餐", price: 135, daily_limit: 7, category: "日式", calories: 650, tags: ["魚類", "湯品"], image_url: null, ai_score: 95 },
  { id: 112, vendor_id: 6, vendor_name: "海線食堂", name: "鯖魚定食", price: 130, daily_limit: 6, category: "日式", calories: 640, tags: ["魚類"], image_url: null, ai_score: 93 },
];

export function getMockVendor(vendorId) {
  return MOCK_VENDORS.find((v) => String(v.id) === String(vendorId)) || null;
}
export function getMockMenusByVendor(vendorId) {
  return MOCK_MENUS.filter((m) => String(m.vendor_id) === String(vendorId));
}
// 依廠區篩出該區服務的商家（vendor 沒設 zones 就視為全廠區都有）
export function getMockVendorsByZone(zone) {
  if (!zone) return MOCK_VENDORS;
  return MOCK_VENDORS.filter((v) => !v.zones || v.zones.includes(zone));
}

// ↓↓ 以下原樣保留，不要刪 ↓↓
export const MOCK_ORDERS = [
  {
    id: "ORD-20260528-001",
    vendor_name: "綠能輕食",
    status: "ready",
    order_date: "2026-05-25",
    target_date: "2026-05-27",   // 預定配送/取餐日期（七天預訂）
    pickup_time: "12:20",
    items: [
      { menu_id: 102, name: "藜麥舒肥雞餐盒", price: 125, quantity: 1 },
      { menu_id: 108, name: "凱薩雞肉沙拉", price: 115, quantity: 2 },
    ],
    total_amount: 355,
    cancel_reason: "",
  },
  {
    id: "ORD-20260524-004",
    vendor_name: "廠區熱食站",
    status: "completed",
    order_date: "2026-05-24",
    target_date: "2026-05-24",
    pickup_time: "12:10",
    items: [{ menu_id: 104, name: "番茄牛肉燴飯", price: 115, quantity: 1 }],
    total_amount: 115,
    cancel_reason: "",
  },
  {
    id: "ORD-20260523-009",
    vendor_name: "晶彩蔬食",
    status: "cancelled",
    order_date: "2026-05-23",
    target_date: "2026-05-23",
    pickup_time: "12:30",
    items: [{ menu_id: 105, name: "菇菇蔬菜咖哩", price: 100, quantity: 2 }],
    total_amount: 200,
    cancel_reason: "會議取消",
  },
];

export function getMockOrder(id) {
  return MOCK_ORDERS.find((o) => String(o.id) === String(id)) || null;
}

export const MOCK_NOTIFICATIONS = [
  { id: "N-1001", type: "pickup", title: "餐點可領取", message: "藜麥舒肥雞餐盒已送達 3F 領餐區。", created_at: "2026-05-25T12:05:00+08:00", read_at: null },
  { id: "N-1002", type: "today", title: "今日訂單提醒", message: "你今天的訂單預計 12:20 領取。", created_at: "2026-05-25T10:30:00+08:00", read_at: "2026-05-25T10:35:00+08:00" },
  { id: "N-1003", type: "cancel", title: "訂單取消成功", message: "ORD-20260523-009 已取消，薪資扣款會同步更新。", created_at: "2026-05-23T09:50:00+08:00", read_at: "2026-05-23T10:00:00+08:00" },
];

export const MOCK_APPEALS = [
  { id: "APL-20260525-001", order_id: "ORD-20260525-001", employee_name: "Jenny Chen", reason: "late_delivery", message: "餐點比預計時間晚 25 分鐘送達，影響午休安排。", status: "submitted", created_at: "2026-05-25T13:04:00+08:00" },
  { id: "APL-20260524-003", order_id: "ORD-20260524-004", employee_name: "Alex Lin", reason: "payment_issue", message: "訂單取消後薪資扣款狀態仍顯示待扣。", status: "reviewing", created_at: "2026-05-24T15:16:00+08:00" },
];

export const MOCK_USERS = [
  { id: 7, email: "jenny20030314@gmail.com", role: "admin", created_at: "2026-05-25T14:36:03.959Z" },
  { id: 15, email: "newuser@test.com", role: "employee", created_at: "2026-05-25T14:36:03.959Z" },
];

export const MOCK_EMPLOYEES = [
  { id: 1, user_id: 15, employee_no: "E260501", name: "王小明", department: "Fab 12A", phone: "0912-345-678" },
];

export const MOCK_INCIDENTS = [
  { id: "INC-20260525-002", user_id: 15, title: "取消訂單扣款覆核", amount: 125, status: "open", created_at: "2026-05-25T16:20:00+08:00" },
  { id: "INC-20260524-001", user_id: 15, title: "商家延遲補償", amount: 30, status: "resolved", created_at: "2026-05-24T14:10:00+08:00" },
];

export const MOCK_STATEMENTS = [
  { id: "STM-202605", user_id: 15, period: "2026-05", total_amount: 640, status: "pending" },
  { id: "STM-202604", user_id: 15, period: "2026-04", total_amount: 1180, status: "closed" },
];


// === 通知 / 申訴用的小工具 ===
export function getMockNotification(id) {
  return MOCK_NOTIFICATIONS.find((n) => String(n.id) === String(id)) || null;
}
export function markMockNotificationRead(id) {
  const n = getMockNotification(id);
  if (n && !n.read_at) n.read_at = new Date().toISOString();
  return n;
}
export function markAllMockNotificationsRead() {
  const now = new Date().toISOString();
  MOCK_NOTIFICATIONS.forEach((n) => {
    if (!n.read_at) n.read_at = now;
  });
}
export function getMockAppeal(id) {
  return MOCK_APPEALS.find((a) => String(a.id) === String(id)) || null;
}