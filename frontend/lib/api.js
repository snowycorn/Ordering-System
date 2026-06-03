// lib/api.js
export const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "token";
export const ROLE_COOKIE_NAME = process.env.AUTH_ROLE_COOKIE_NAME || "role";

const DEFAULT_SERVICES = {
  iam: "http://140.113.62.166:3001",
  notification: "http://140.113.62.166:3002",
  recommendation: "http://140.113.62.166:3003",
  billing: "http://140.113.62.166:3004",
  appeal: "http://140.113.62.166:3005",
};

const GATEWAY_URL = process.env.BACKEND_URL || process.env.API_GATEWAY_URL || "";

export const USE_LOCAL_MOCKS =
  process.env.USE_LOCAL_MOCKS === "true" ||
  (process.env.NODE_ENV !== "production" && process.env.USE_LOCAL_MOCKS !== "false");

export const SERVICES = {
  iam: process.env.IAM_URL || DEFAULT_SERVICES.iam,
  notification: process.env.NOTIFICATION_URL || DEFAULT_SERVICES.notification,
  recommendation: process.env.RECOMMENDATION_URL || DEFAULT_SERVICES.recommendation,
  billing: process.env.BILLING_URL || DEFAULT_SERVICES.billing,
  appeal: process.env.APPEAL_URL || DEFAULT_SERVICES.appeal,
  vendor: process.env.VENDOR_URL || GATEWAY_URL || "",
  order: process.env.ORDER_URL || GATEWAY_URL || "",
};

export const ENDPOINTS = {
  iamLogin: process.env.IAM_LOGIN_PATH || "/auth/login",
  iamUsers: process.env.IAM_USERS_PATH || "/users",
  iamEmployees: process.env.IAM_EMPLOYEES_PATH || "/employees",
  iamEmployeeByUser: process.env.IAM_EMPLOYEE_BY_USER_PATH || "/employees/user/:id",

  vendors: process.env.VENDOR_LIST_PATH || "/api/v1/vendors",
  vendorById: process.env.VENDOR_BY_ID_PATH || "/api/v1/vendors/:id",
  vendorMenus: process.env.VENDOR_MENUS_BY_ID_PATH || "/api/v1/vendors/:id/menus",
  menus: process.env.VENDOR_MENUS_PATH || "/api/v1/menus",

  vendorMe: "/api/v1/vendors/me",
  vendorMeMenus: "/api/v1/vendors/me/menus",
  vendorMeMenuDetail: "/api/v1/vendors/me/menus/:menuId",
  vendorMeQuotas: "/api/v1/vendors/me/menus/:menuId/quotas",
  vendorUploadUrl: "/api/v1/vendors/me/menus/upload-image-url",

  vendorOrders: process.env.VENDOR_ORDERS_PATH || "/vendor/orders/vendor/:id",
  vendorOrderReject: "/vendor/orders/:id/reject",

  orders: process.env.ORDER_COLLECTION_PATH || "/orders",
  ordersMe: process.env.ORDER_ME_PATH || "/orders/me",
  orderCancel: process.env.ORDER_CANCEL_PATH || "/orders/:id/cancel",
  orderComplete: process.env.ORDER_COMPLETE_PATH || "/orders/:id/complete",
  orderUpdateQty: process.env.ORDER_QTY_PATH || "/orders/:id/quantity",

  appeals: process.env.APPEAL_COLLECTION_PATH || "/appeals",
  notifications: process.env.NOTIFICATION_COLLECTION_PATH || "/notifications",
  notificationsByUser: process.env.NOTIFICATION_BY_USER_PATH || "/notifications/user/:id",
  notificationMarkRead: process.env.NOTIFICATION_MARK_READ_PATH || "/notifications/user/:id/read",

  preferences: process.env.RECOMMENDATION_PREFERENCES_PATH || "/preferences",
  preferencesByUser: process.env.RECOMMENDATION_PREFERENCES_BY_USER_PATH || "/preferences/user/:id",
  recommendationCache: process.env.RECOMMENDATION_CACHE_PATH || "/cache",
  recommendationCacheForUser: process.env.RECOMMENDATION_CACHE_BY_USER_PATH || "/cache/user/:id",

  billingStatements: process.env.BILLING_STATEMENTS_PATH || "/billing/statements",
  billingStatementsByUser: process.env.BILLING_STATEMENTS_BY_USER_PATH || "billing/statements/user/:id",
  billingIncidents: process.env.BILLING_INCIDENTS_PATH || "/billing/incidents",
  billingIncidentsByUser: process.env.BILLING_INCIDENTS_BY_USER_PATH || "billing/incidents/user/:id",
};

export function serviceUrl(base, path = "") {
  if (!base) return "";
  const cleanBase = base.replace(/\/+$/, "");
  const cleanPath = path ? `/${String(path).replace(/^\/+/, "")}` : "";
  return `${cleanBase}${cleanPath}`;
}

export function withPathParams(path, params = {}) {
  return Object.entries(params).reduce(
    (current, [key, value]) =>
      current
        .replace(`:${key}`, encodeURIComponent(value))
        .replace(`{${key}}`, encodeURIComponent(value)),
    path,
  );
}

export function authCookieOptions() {
  const isSecure = process.env.COOKIE_SECURE === "true";
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: Number(process.env.AUTH_COOKIE_MAX_AGE || 60 * 60 * 8),
  };
}

export function parseJwt(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
    return {
      userId: payload.userId ?? payload.id ?? null,
      role: payload.role ?? null,
    };
  } catch {
    return { userId: null, role: null };
  }
}

export async function apiFetch(
  url,
  { token, method = "GET", body, headers = {}, cache = "no-store" } = {},
) {
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const customHeaders = {};
  if (token) {
    const { userId, role } = parseJwt(token);
    if (userId) customHeaders["x-user-id"] = String(userId);
    if (role) customHeaders["x-user-role"] = String(role);
  }

  return fetch(url, {
    method,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...customHeaders,
      ...headers,
    },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
    cache,
  });
}

export async function jsonOrEmpty(response) {
  return response.json().catch(() => ({}));
}
