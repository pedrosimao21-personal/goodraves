import { auth } from "./auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Protect dashboard/friends/following routes — require authentication
  const isProtected =
    pathname === "/dashboard" || pathname.startsWith("/dashboard/") ||
    pathname === "/friends" || pathname.startsWith("/friends/") ||
    pathname === "/following" || pathname.startsWith("/following/");

  if (isProtected && !req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  // /api/auth, /api/register and the logged-out email flows are excluded here
  // (rather than checked and passed through inside the handler above) so
  // NextAuth's auth() wrapper skips its session decode entirely for routes that
  // never need it.
  matcher: ["/dashboard/:path*", "/friends/:path*", "/following/:path*", "/api/((?!auth|register|email|password-reset|unsubscribe).*)"],
};
