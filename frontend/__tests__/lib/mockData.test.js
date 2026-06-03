import {
  MOCK_APPEALS,
  MOCK_MENUS,
  MOCK_NOTIFICATIONS,
  MOCK_ORDERS,
  MOCK_VENDORS,
  getMockAppeal,
  getMockMenusByVendor,
  getMockNotification,
  getMockOrder,
  getMockVendor,
  getMockVendorsByZone,
  markAllMockNotificationsRead,
  markMockNotificationRead,
} from "@/lib/mockData";

describe("mock data helpers", () => {
  it("finds vendors, menus, orders, notifications, and appeals by id", () => {
    const vendor = MOCK_VENDORS[0];
    const order = MOCK_ORDERS[0];
    const notification = MOCK_NOTIFICATIONS[0];
    const appeal = MOCK_APPEALS[0];

    expect(getMockVendor(vendor.id)).toBe(vendor);
    expect(getMockVendor("missing")).toBeNull();
    expect(getMockMenusByVendor(vendor.id)).toEqual(
      MOCK_MENUS.filter((menu) => String(menu.vendor_id) === String(vendor.id)),
    );
    expect(getMockOrder(order.id)).toBe(order);
    expect(getMockNotification(notification.id)).toBe(notification);
    expect(getMockAppeal(appeal.id)).toBe(appeal);
  });

  it("filters vendors by factory zone and returns all vendors without a zone", () => {
    expect(getMockVendorsByZone()).toBe(MOCK_VENDORS);
    expect(getMockVendorsByZone("A")).toEqual(
      MOCK_VENDORS.filter((vendor) => !vendor.zones || vendor.zones.includes("A")),
    );
  });

  it("marks one or all notifications as read", () => {
    const unread = MOCK_NOTIFICATIONS.find((notification) => !notification.read_at);
    unread.read_at = null;

    expect(markMockNotificationRead(unread.id)).toBe(unread);
    expect(unread.read_at).toEqual(expect.any(String));
    expect(markMockNotificationRead("missing")).toBeNull();

    MOCK_NOTIFICATIONS.forEach((notification) => {
      notification.read_at = null;
    });
    markAllMockNotificationsRead();

    expect(MOCK_NOTIFICATIONS.every((notification) => notification.read_at)).toBe(true);
  });
});
