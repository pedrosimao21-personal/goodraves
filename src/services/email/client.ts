/**
 * Transactional email through Resend (https://resend.com/docs/api-reference/emails/send-email).
 *
 * Plain server-only transport module, deliberately NOT `"use server"` (that would
 * expose `sendEmail` as a public Server Action). Call only from `src/db/*`.
 *
 * Needs RESEND_API_KEY and EMAIL_FROM ("Goodraves <noreply@goodraves.com>", on a
 * domain verified in Resend). Without a key, development prints the message to the
 * server console so flows can be tried locally; production reports "not-configured".
 */

import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { CONTACT_EMAIL } from "@/lib/site";

const RESEND_URL = "https://api.resend.com/emails";

export type EmailMessage = { to: string; subject: string; text: string; html: string };
export type SendResult = "sent" | "logged" | "not-configured";

export async function sendEmail(message: EmailMessage): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") return "not-configured";
    console.info(`[email:dev] To: ${message.to}\nSubject: ${message.subject}\n${message.text}`);
    return "logged";
  }

  const res = await fetchWithTimeout(RESEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [message.to], reply_to: CONTACT_EMAIL, subject: message.subject, text: message.text, html: message.html }),
  });
  if (!res.ok) throw new Error(`Resend error ${res.status}: ${await res.text()}`);
  return "sent";
}
