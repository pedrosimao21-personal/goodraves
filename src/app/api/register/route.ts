import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { sql } from "drizzle-orm";
import { isRateLimited } from "@/db/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { getPasswordError, hashPassword } from "@/lib/password";
import { normalizeEmail } from "@/lib/email-address";
import { isSameOrigin } from "@/lib/same-origin";
import { isEmailVerifiedByOther, releaseUnverifiedEmail, trySendVerificationEmail } from "@/db/account-email";

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 30;

export async function POST(req: NextRequest) {
  try {
    // CSRF protection: same-origin requests only.
    if (!isSameOrigin(req.headers)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const ip = getClientIp(req.headers);
    if (await isRateLimited(ip, "register", RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const { username, password, email: rawEmail } = await req.json();

    if (!username || typeof username !== "string" || username.length < MIN_USERNAME_LENGTH) {
      return NextResponse.json(
        { error: `Username must be at least ${MIN_USERNAME_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (username.length > MAX_USERNAME_LENGTH) {
      return NextResponse.json(
        { error: `Username must be at most ${MAX_USERNAME_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return NextResponse.json(
        { error: "Username can only contain letters, numbers, hyphens and underscores" },
        { status: 400 }
      );
    }

    const passwordError = getPasswordError(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const email = normalizeEmail(rawEmail);
    if (!email) {
      return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
    }

    // Check if username already exists (case-insensitive). Only existence is
    // needed, so select a single lightweight column.
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.username}) = lower(${username})`)
      .limit(1);

    // A generic error for a taken username or email, so neither can be probed.
    if (existing || (await isEmailVerifiedByOther(email))) {
      return NextResponse.json(
        { error: "Registration failed. Please try a different username or email." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    await releaseUnverifiedEmail(email);
    const [created] = await db.insert(users).values({ username, passwordHash, email }).returning({ id: users.id });

    // The account exists either way; if the mail can't go out, the profile can resend it.
    const isEmailSent = await trySendVerificationEmail(created.id, email);

    return NextResponse.json({ success: true, isEmailSent }, { status: 201 });
  } catch (err) {
    console.error("Registration error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
