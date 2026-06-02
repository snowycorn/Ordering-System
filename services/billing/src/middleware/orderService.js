// billing/src/middleware/orderService.js 改成這樣

let cachedToken = null;
let tokenExpiry = 0;

const getAdminToken = async () => {
  // token 還有超過 5 分鐘就直接用
  if (cachedToken && Date.now() < tokenExpiry - 5 * 60 * 1000) {
    return cachedToken;
  }

  // 重新登入
  const res = await fetch(`${process.env.IAM_SERVICE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: process.env.INTERNAL_ADMIN_EMAIL,
      password: process.env.INTERNAL_ADMIN_PASSWORD,
    }),
  });

  if (!res.ok) throw new Error("Failed to get internal admin token");

  const data = await res.json();
  cachedToken = data.token;
  // JWT 24 小時過期，記錄到期時間
  tokenExpiry = Date.now() + 24 * 60 * 60 * 1000;
  return cachedToken;
};

const getOrdersByVendor = async (vendorId, period) => {
  const token = await getAdminToken(); // 自動取得或更新 token

  const url = new URL(`${process.env.ORDER_SERVICE_URL}/orders/vendor/${vendorId}`);
  if (period) url.searchParams.set("period", period);

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Order service error ${response.status}: ${err.error || "unknown"}`);
  }

  return response.json();
};

module.exports = { getOrdersByVendor };