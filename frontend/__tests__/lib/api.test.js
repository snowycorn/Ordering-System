import {
  apiFetch,
  authCookieOptions,
  jsonOrEmpty,
  parseJwt,
  serviceUrl,
  withPathParams,
} from "@/lib/api";

function tokenWithPayload(payload) {
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `header.${encodedPayload}.signature`;
}

describe("api helpers", () => {
  afterEach(() => {
    delete global.fetch;
  });

  it("joins service base URLs and paths without duplicate slashes", () => {
    expect(serviceUrl("https://api.example.com///", "///orders")).toBe(
      "https://api.example.com/orders",
    );
    expect(serviceUrl("https://api.example.com", "")).toBe("https://api.example.com");
    expect(serviceUrl("", "/orders")).toBe("");
  });

  it("replaces colon and brace path params with encoded values", () => {
    expect(
      withPathParams("/users/:id/vendors/{vendorId}", {
        id: "user@example.com",
        vendorId: "A/B",
      }),
    ).toBe("/users/user%40example.com/vendors/A%2FB");
  });

  it("parses user id and role from JWT payloads", () => {
    expect(parseJwt(tokenWithPayload({ userId: "u-1", role: "employee" }))).toEqual({
      userId: "u-1",
      role: "employee",
    });
    expect(parseJwt(tokenWithPayload({ id: 42, role: "vendor" }))).toEqual({
      userId: 42,
      role: "vendor",
    });
    expect(parseJwt("not-a-token")).toEqual({ userId: null, role: null });
  });

  it("builds secure http-only cookie options from environment values", () => {
    const previousSecure = process.env.COOKIE_SECURE;
    const previousMaxAge = process.env.AUTH_COOKIE_MAX_AGE;
    process.env.COOKIE_SECURE = "true";
    process.env.AUTH_COOKIE_MAX_AGE = "120";

    expect(authCookieOptions()).toEqual({
      httpOnly: true,
      maxAge: 120,
      path: "/",
      sameSite: "lax",
      secure: true,
    });

    process.env.COOKIE_SECURE = previousSecure;
    process.env.AUTH_COOKIE_MAX_AGE = previousMaxAge;
  });

  it("sends JSON requests with auth and user context headers", async () => {
    const token = tokenWithPayload({ userId: "u-1", role: "employee" });
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    await apiFetch("https://api.example.com/orders", {
      token,
      method: "POST",
      body: { menu_id: "m-1", quantity: 1 },
      headers: { "x-request-id": "request-1" },
    });

    expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/orders", {
      body: JSON.stringify({ menu_id: "m-1", quantity: 1 }),
      cache: "no-store",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "x-request-id": "request-1",
        "x-user-id": "u-1",
        "x-user-role": "employee",
      },
      method: "POST",
    });
  });

  it("does not force a JSON content type for FormData payloads", async () => {
    const formData = new FormData();
    formData.append("file", new Blob(["demo"]), "demo.txt");
    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    await apiFetch("https://api.example.com/upload", {
      body: formData,
      method: "POST",
    });

    expect(global.fetch).toHaveBeenCalledWith("https://api.example.com/upload", {
      body: formData,
      cache: "no-store",
      headers: {},
      method: "POST",
    });
  });

  it("returns an empty object when a response has no JSON body", async () => {
    await expect(jsonOrEmpty({ json: jest.fn().mockRejectedValue(new Error("empty")) }))
      .resolves
      .toEqual({});
  });
});
