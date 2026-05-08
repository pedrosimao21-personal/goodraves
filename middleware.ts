import { auth } from "./auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Don't protect the register API (users need it to sign up)
  if (pathname === "/api/register") {
    return NextResponse.next();
  }

  // Don't protect auth routes
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Protect dashboard routes — require authentication
  const isProtected = pathname === "/dashboard" || pathname.startsWith("/dashboard/");

  if (isProtected && !req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/api/:path*"],
};
