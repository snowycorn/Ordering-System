import { getNextDays, isValidDate } from "@/lib/dates";

describe("date helpers", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns upcoming day values and keeps tomorrow selectable before 17:00", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 3, 16, 30));

    const days = getNextDays(2);

    expect(days).toHaveLength(2);
    expect(days[0]).toMatchObject({
      value: "2026-06-04",
      disabled: false,
      disabledReason: "",
    });
    expect(days[0].label).toMatch(/^6\/4/);
    expect(days[1].value).toBe("2026-06-05");
  });

  it("disables tomorrow after the 17:00 order cutoff", () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 5, 3, 17, 0));

    const [tomorrow, dayAfterTomorrow] = getNextDays(2);

    expect(tomorrow.disabled).toBe(true);
    expect(tomorrow.disabledReason).toEqual(expect.any(String));
    expect(tomorrow.disabledReason.length).toBeGreaterThan(0);
    expect(dayAfterTomorrow.disabled).toBe(false);
  });

  it("validates yyyy-mm-dd shaped strings", () => {
    expect(isValidDate("2026-06-04")).toBe(true);
    expect(isValidDate("2026/06/04")).toBe(false);
    expect(isValidDate("")).toBe(false);
    expect(isValidDate(null)).toBe(false);
  });
});
