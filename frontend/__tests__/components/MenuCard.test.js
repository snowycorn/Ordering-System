import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MenuCard from "@/components/MenuCard";

const menu = {
  category: "Lunch",
  daily_limit: 3,
  id: "menu-1",
  name: "Chicken Bento",
  price: 120,
  tags: ["popular", "hot"],
  vendor_id: "vendor-1",
  vendor_name: "Demo Vendor",
};

describe("MenuCard", () => {
  afterEach(() => {
    delete global.fetch;
  });

  it("posts an order payload and refreshes on success", async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    render(<MenuCard menu={menu} date="2026-06-05" />);

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(global.__NEXT_NAVIGATION_MOCKS__.router.refresh).toHaveBeenCalledTimes(1);
    });

    const [, options] = global.fetch.mock.calls[0];
    expect(global.fetch).toHaveBeenCalledWith("/api/orders", expect.objectContaining({
      headers: { "Content-Type": "application/json" },
      method: "POST",
    }));
    expect(JSON.parse(options.body)).toEqual({
      menuId: "menu-1",
      menu_id: "menu-1",
      quantity: 1,
      targetDate: "2026-06-05",
      target_date: "2026-06-05",
      vendorId: "vendor-1",
      vendor_id: "vendor-1",
    });
  });

  it("disables ordering when the menu is sold out", async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn();

    render(<MenuCard menu={{ ...menu, daily_limit: 0 }} date="2026-06-05" />);

    const orderButton = screen.getByRole("button");
    expect(orderButton).toBeDisabled();

    await user.click(orderButton);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
