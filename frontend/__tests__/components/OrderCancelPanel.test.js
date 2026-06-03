import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OrderCancelPanel from "@/components/OrderCancelPanel";

describe("OrderCancelPanel", () => {
  afterEach(() => {
    delete global.fetch;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("renders a locked panel for completed orders", () => {
    render(<OrderCancelPanel orderId="order-1" status="completed" targetDate="2026-06-05" />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a locked panel after the cancellation deadline", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 4, 17, 0));

    render(<OrderCancelPanel orderId="order-1" status="confirmed" targetDate="2026-06-05" />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("submits a cancellation reason and refreshes the route", async () => {
    jest.useFakeTimers({ doNotFake: ["setTimeout"] }).setSystemTime(new Date(2026, 5, 4, 16, 0));
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    jest.spyOn(window, "confirm").mockReturnValue(true);
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({}),
      ok: true,
    });

    render(
      <OrderCancelPanel
        initialReason="schedule changed"
        orderId="order-1"
        status="confirmed"
        targetDate="2026-06-05"
      />,
    );

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(global.__NEXT_NAVIGATION_MOCKS__.router.refresh).toHaveBeenCalledTimes(1);
    });
    const [, options] = global.fetch.mock.calls[0];
    expect(global.fetch).toHaveBeenCalledWith("/api/orders/order-1", expect.objectContaining({
      headers: { "Content-Type": "application/json" },
      method: "DELETE",
    }));
    expect(JSON.parse(options.body)).toEqual({
      cancel_reason: "schedule changed",
      reason: "schedule changed",
    });
  });

  it("does not submit when the confirmation is rejected", async () => {
    jest.useFakeTimers({ doNotFake: ["setTimeout"] }).setSystemTime(new Date(2026, 5, 4, 16, 0));
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    jest.spyOn(window, "confirm").mockReturnValue(false);
    global.fetch = jest.fn();

    render(<OrderCancelPanel orderId="order-1" status="confirmed" targetDate="2026-06-05" />);

    await user.click(screen.getByRole("button"));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
