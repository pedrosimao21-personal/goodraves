import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isRateLimited } from "@/db/rate-limit";
import { consumeAuthToken } from "@/db/auth-tokens";
import { getClientIp } from "@/lib/client-ip";
import { getPasswordError, hashPassword } from "@/lib/password";
import { isSameOrigin } from "@/lib/same-origin";
import { RATE_LIMIT_EMAIL_FLOW_WINDOW_MS, RATE_LIMIT_TOKEN_REDEEM_MAX } from "@/lib/constants";

const INVALID_LINK = "This link is invalid or has expired. Request a new one.";

/** Sets a new password from the emailed link. The password is checked first so a typo doesn't burn the single-use link. */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req.headers)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (await isRateLimited(getClientIp(req.headers), "password-reset-confirm", RATE_LIMIT_TOKEN_REDEEM_MAX, RATE_LIMIT_EMAIL_FLOW_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const { token, password } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || !token) return NextResponse.json({ error: INVALID_LINK }, { status: 400 });

  const passwordError = getPasswordError(password);
  if (passwordError) return NextResponse.json({ error: passwordError }, { status: 400 });

  const redeemed = await consumeAuthToken(token, "reset_password");
  if (!redeemed) return NextResponse.json({ error: INVALID_LINK }, { status: 400 });

  // Following the link also proves the address is theirs. Like verification, it
  // only applies while the account still has the address the link went to.
  const updated = await db
    .update(users)
    .set({ passwordHash: await hashPassword(password), emailVerifiedAt: new Date() })
    .where(and(eq(users.id, redeemed.userId), sql`lower(${users.email}) = ${redeemed.email}`))
    .returning({ id: users.id });
  if (updated.length === 0) return NextResponse.json({ error: INVALID_LINK }, { status: 400 });

  return NextResponse.json({ success: true });
}
