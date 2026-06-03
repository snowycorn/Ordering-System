import { canCancelOrder, cancelDeadlineLabel } from "@/lib/orderCutoff";

describe("order cutoff helpers", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("allows cancellation before the previous day 17:00 cutoff", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 4, 16, 59));

    expect(canCancelOrder("2026-06-05")).toBe(true);
  });

  it("blocks cancellation at and after the cutoff", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 4, 17, 0));

    expect(canCancelOrder("2026-06-05")).toBe(false);
  });

  it("allows cancellation when no target date is provided", () => {
    expect(canCancelOrder()).toBe(true);
  });

  it("formats the cancellation deadline date", () => {
    expect(cancelDeadlineLabel("2026-06-05")).toMatch(/^06\/04 17:00/);
    expect(cancelDeadlineLabel()).toBe("");
  });
});
