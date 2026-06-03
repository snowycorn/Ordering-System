import { render, screen } from "@testing-library/react";
import VendorCard from "@/components/VendorCard";

const vendor = {
  category: "Bento",
  description: "Fresh lunch boxes",
  eta: "10 min",
  id: "vendor-1",
  image_url: "https://example.com/vendor.jpg",
  is_open: true,
  name: "Demo Vendor",
  rating: 4.8,
  tags: ["hot", "healthy", "popular", "extra"],
};

describe("VendorCard", () => {
  it("links to the vendor detail page and preserves query strings", () => {
    render(<VendorCard vendor={vendor} query="zone=A" />);

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/employee/vendors/vendor-1?zone=A");
    expect(screen.getByRole("img", { name: "Demo Vendor" })).toHaveStyle({
      backgroundImage: "url(https://example.com/vendor.jpg)",
    });
  });

  it("renders a closed vendor as unavailable", () => {
    render(<VendorCard vendor={{ ...vendor, image_url: null, is_open: false }} />);

    expect(screen.getByRole("link")).toHaveClass("pointer-events-none");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
