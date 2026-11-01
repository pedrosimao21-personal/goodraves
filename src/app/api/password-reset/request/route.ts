import { NextRequest, NextResponse, after } from "next/server";
import { and, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isRateLimited } from "@/db/rate-limit";
import { sendPasswordResetEmail } from "@/db/account-email";
import { getClientIp } from "@/lib/client-ip";
import { normalizeEmail } from "@/lib/email-address";
import { isSameOrigin } from "@/lib/same-origin";
import {
  RATE_LIMIT_EMAIL_FLOW_MAX,
  RATE_LIMIT_EMAIL_FLOW_WINDOW_MS,
  RATE_LIMIT_RESET_PER_ADDRESS_MAX,
  RATE_LIMIT_RESET_PER_ADDRESS_WINDOW_MS,
} from "@/lib/constants";

async function mailResetLink(email: string): Promise<void> {
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(sql`lower(${users.email}) = ${email}`, isNotNull(users.emailVerifiedAt)))
    .limit(1);
  if (user) await sendPasswordResetEmail(user.id, email);
}

/**
 * Asks for a password-reset link. The answer is the same whether or not the
 * address belongs to an account (no way to probe which emails are registered),
 * and the lookup and send run after the response so the timing doesn't give it
 * away either. Only verified addresses receive a link.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req.headers)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ip = getClientIp(req.headers);
  if (await isRateLimited(ip, "password-reset", RATE_LIMIT_EMAIL_FLOW_MAX, RATE_LIMIT_EMAIL_FLOW_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const { email: rawEmail } = await req.json().catch(() => ({}));
  const email = normalizeEmail(rawEmail);
  if (!email) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });

  // Per address too, so one person's inbox can't be flooded from many IPs. Still the same answer.
  const isAddressLimited = await isRateLimited(email, "password-reset-address", RATE_LIMIT_RESET_PER_ADDRESS_MAX, RATE_LIMIT_RESET_PER_ADDRESS_WINDOW_MS);
  if (!isAddressLimited) {
    after(() =>
      mailResetLink(email).catch((err) => console.error("[password-reset] could not send the link:", err))
    );
  }

  return NextResponse.json({ success: true });
}
