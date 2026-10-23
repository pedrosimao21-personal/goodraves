import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { sql } from "drizzle-orm";
import { isRateLimited } from "@/db/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { getPasswordError, hashPassword } from "@/lib/password";

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 30;

export async function POST(req: NextRequest) {
  try {
    // CSRF protection: require a same-origin request. Reject when the Origin
    // header is missing entirely, and compare the host exactly (not substring)
    // so a hostile origin merely *containing* our host can't pass.
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    let originHost: string | null = null;
    try {
      originHost = origin ? new URL(origin).host : null;
    } catch {
      originHost = null;
    }
    if (!originHost || !host || originHost !== host) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    const ip = getClientIp(req.headers);
    if (await isRateLimited(ip, "register", RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }

    const { username, password } = await req.json();

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

    // Check if username already exists (case-insensitive). Only existence is
    // needed, so select a single lightweight column.
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.username}) = lower(${username})`)
      .limit(1);

    if (existing) {
      // Use a generic error to prevent username enumeration
      return NextResponse.json(
        { error: "Registration failed. Please try a different username." },
        { status: 400 }
      );
    }

    const passwordHash = await hashPassword(password);

    await db.insert(users).values({
      username,
      passwordHash,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("Registration error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
