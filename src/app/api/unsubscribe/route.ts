import { NextRequest, NextResponse } from "next/server";
import { setNotificationSetting } from "@/db/notification-settings";
import { readUnsubscribeToken } from "@/lib/unsubscribe-token";

/**
 * Switches off the notification a signed link was made for. Called two ways: by the
 * "Unsubscribe" button on /unsubscribe, and directly by mail apps that follow the
 * List-Unsubscribe-Post header (RFC 8058), which send no cookies or Origin. The signed
 * token is the only credential and can do nothing but turn one notification off, so there
 * is no same-origin check. A POST, never a GET: mail scanners open links in advance.
 */
export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t") ?? "";
  const parsed = readUnsubscribeToken(token);
  if (!parsed) return NextResponse.json({ error: "This unsubscribe link is not valid." }, { status: 400 });

  await setNotificationSetting(parsed.userId, parsed.kind, false);
  return NextResponse.json({ success: true });
}
