import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isRateLimited } from "@/db/rate-limit";
import { consumeAuthToken } from "@/db/auth-tokens";
import { getClientIp } from "@/lib/client-ip";
import { isSameOrigin } from "@/lib/same-origin";
import { RATE_LIMIT_EMAIL_FLOW_WINDOW_MS, RATE_LIMIT_TOKEN_REDEEM_MAX } from "@/lib/constants";

const INVALID_LINK = "This link is invalid or has expired. Request a new one from your profile.";

/**
 * Confirms an email address from the emailed link. A POST (the page asks the
 * visitor to press a button) so mail scanners that open links in advance can't
 * use the single-use token up.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req.headers)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (await isRateLimited(getClientIp(req.headers), "email-verify", RATE_LIMIT_TOKEN_REDEEM_MAX, RATE_LIMIT_EMAIL_FLOW_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const { token } = await req.json().catch(() => ({}));
  if (typeof token !== "string" || !token) return NextResponse.json({ error: INVALID_LINK }, { status: 400 });

  const redeemed = await consumeAuthToken(token, "verify_email");
  if (!redeemed) return NextResponse.json({ error: INVALID_LINK }, { status: 400 });

  // The link only counts for the address it was sent to: if the account's address
  // changed since, nothing matches and the link is just stale.
  const verified = await db
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    .where(and(eq(users.id, redeemed.userId), sql`lower(${users.email}) = ${redeemed.email}`))
    .returning({ id: users.id });
  if (verified.length === 0) return NextResponse.json({ error: INVALID_LINK }, { status: 400 });

  return NextResponse.json({ success: true });
}
