import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MarkAllReadButton from "@/components/MarkAllReadButton";

describe("MarkAllReadButton", () => {
  afterEach(() => {
    delete global.fetch;
  });

  it("marks all notifications as read and refreshes the route", async () => {
    const user = userEvent.setup();
    const dispatchSpy = jest.spyOn(window, "dispatchEvent");
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    render(<MarkAllReadButton disabled={false} />);

    await user.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(global.__NEXT_NAVIGATION_MOCKS__.router.refresh).toHaveBeenCalledTimes(1);
    });
    expect(global.fetch).toHaveBeenCalledWith("/api/notifications", {
      body: JSON.stringify({ all: true }),
      headers: { "Content-Type": "application/json" },
      method: "PATCH",
    });
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: "notifications:updated",
    }));
  });

  it("does nothing when disabled", async () => {
    const user = userEvent.setup();
    global.fetch = jest.fn();

    render(<MarkAllReadButton disabled />);

    await user.click(screen.getByRole("button"));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
