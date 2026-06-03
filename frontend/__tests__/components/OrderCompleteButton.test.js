import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OrderCompleteButton from "@/components/OrderCompleteButton";

describe("OrderCompleteButton", () => {
  afterEach(() => {
    delete global.fetch;
    jest.restoreAllMocks();
  });

  it("renders nothing unless the order is confirmed", () => {
    const { container } = render(<OrderCompleteButton orderId="order-1" status="pending" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("confirms completion and refreshes the route", async () => {
    const user = userEvent.setup();
    jest.spyOn(window, "confirm").mockReturnValue(true);
    jest.spyOn(window, "alert").mockImplementation(() => {});
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({}),
      ok: true,
    });

    render(<OrderCompleteButton orderId="order-1" status="confirmed" />);

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(global.__NEXT_NAVIGATION_MOCKS__.router.refresh).toHaveBeenCalledTimes(1);
    });
    expect(global.fetch).toHaveBeenCalledWith("/api/orders/order-1/complete", {
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
  });
});
