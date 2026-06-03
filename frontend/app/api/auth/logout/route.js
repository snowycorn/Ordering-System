import { NextResponse } from "next/server";
import { COOKIE_NAME, ROLE_COOKIE_NAME } from "@/lib/api";

function clearCookie(response, name) {
  const isSecure = process.env.COOKIE_SECURE === "true";
  response.cookies.set(name, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: isSecure,
    path: "/",
    maxAge: 0,
  });
}

export async function POST() {
  const response = NextResponse.json({ message: "已登出" });

  clearCookie(response, COOKIE_NAME);
  clearCookie(response, ROLE_COOKIE_NAME);
  clearCookie(response, "userId");

  return response;
}
