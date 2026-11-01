import { MAX_EMAIL_LENGTH } from "./constants";

// Deliberately loose: one "@", no spaces, a dot in the domain. The real check
// is the verification email — whether the address works is only known by sending to it.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** The trimmed, lower-cased address, or null when `value` isn't one. Safe on client and server. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(email) ? email : null;
}

/** Login accepts a username or an email: anything with an "@" is treated as an email (usernames can't contain one). */
export function looksLikeEmail(identifier: string): boolean {
  return identifier.includes("@");
}
