import { createHash, randomBytes } from "node:crypto";

const TOKEN_BYTES = 32; // 256 bits: unguessable, so a fast hash is enough to store it

/** A fresh random token for an emailed link. Server-only (node:crypto). */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** What is stored instead of the token, so a database leak doesn't hand out working links. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
