import { NextResponse } from "next/server";

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "token";
const ROLE_COOKIE_NAME = process.env.AUTH_ROLE_COOKIE_NAME || "role";
const PUBLIC_PAGES = ["/", "/login", "/register"];

function inferRole(pathname) {
  if (pathname.startsWith("/vendor")) return "vendor";
  if (pathname.startsWith("/committee")) return "committee";
  return "employee";
}

function roleHome(role) {
  if (role === "vendor") return "/vendor";
  if (role === "committee" || role === "admin") return "/committee";
  return "/employee";
}

function safeInternalPath(value) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "";
  return value;
}

export function proxy(request) {
  const { pathname, searchParams } = request.nextUrl;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const role = request.cookies.get(ROLE_COOKIE_NAME)?.value;
  const isPublicPage = PUBLIC_PAGES.includes(pathname);

  if (pathname.startsWith("/api") || pathname.includes(".")) {
    return NextResponse.next();
  }

  if (!token && !isPublicPage) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    loginUrl.searchParams.set("role", inferRole(pathname));
    return NextResponse.redirect(loginUrl);
  }

  if (token && (pathname === "/login" || pathname === "/register")) {
    const nextPath = safeInternalPath(searchParams.get("next"));
    return NextResponse.redirect(new URL(nextPath || roleHome(role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
