import { handlers } from "../../../../../auth";
import { NextRequest, NextResponse } from "next/server";
import { isRateLimited } from "@/db/rate-limit";
import { getClientIp } from "@/lib/client-ip";

const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

export const { GET } = handlers;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req.headers);
  if (await isRateLimited(ip, "login", RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
    return NextResponse.json(
      { error: "Too many login attempts. Please try again later." },
      { status: 429 }
    );
  }
  return handlers.POST(req);
}
