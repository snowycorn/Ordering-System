import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DateSelector from "@/components/DateSelector";

const days = [
  { value: "2026-06-04", label: "6/4 (Thu)", disabled: false, disabledReason: "" },
  {
    value: "2026-06-05",
    label: "6/5 (Fri)",
    disabled: true,
    disabledReason: "Cutoff passed",
  },
];

describe("DateSelector", () => {
  it("adds and removes selected dates", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    const { rerender } = render(<DateSelector days={days} selected={[]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "6/4 (Thu)" }));
    expect(onChange).toHaveBeenLastCalledWith(["2026-06-04"]);

    rerender(<DateSelector days={days} selected={["2026-06-04"]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "6/4 (Thu)" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("does not call onChange for disabled days", async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    render(<DateSelector days={days} selected={[]} onChange={onChange} />);

    const disabledDay = screen.getByRole("button", { name: "6/5 (Fri)" });
    expect(disabledDay).toBeDisabled();
    expect(disabledDay).toHaveAttribute("title", "Cutoff passed");

    await user.click(disabledDay);
    expect(onChange).not.toHaveBeenCalled();
  });
});
