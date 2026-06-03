import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ZoneSelector from "@/components/ZoneSelector";
import { ZONES } from "@/lib/zones";

describe("ZoneSelector", () => {
  it("pushes the selected zone while preserving existing query params", async () => {
    const user = userEvent.setup();
    global.__NEXT_NAVIGATION_MOCKS__.setPathname("/employee");
    global.__NEXT_NAVIGATION_MOCKS__.setSearchParams("page=2");

    render(<ZoneSelector selected="A" />);

    await user.click(screen.getByRole("button", { name: ZONES[1].label }));

    expect(global.__NEXT_NAVIGATION_MOCKS__.router.push).toHaveBeenCalledWith(
      "/employee?page=2&zone=B",
    );
  });
});
