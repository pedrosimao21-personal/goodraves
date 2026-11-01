import { db } from "@/db";
import { and, eq, gt, isNull, lt, or } from "drizzle-orm";
import { authTokens } from "@/db/schema";
import { generateToken, hashToken } from "@/lib/auth-token";

export type AuthTokenKind = "verify_email" | "reset_password";

/** Used and expired tokens are deleted this long after they stop being useful. */
const PRUNE_GRACE_MS = 24 * 60 * 60 * 1000;

/**
 * Creates a link token for `userId` / `email` and returns it — the only time it
 * exists in the clear. Earlier unused tokens of the same kind are dropped, so only
 * the newest emailed link works.
 */
export async function issueAuthToken(userId: string, kind: AuthTokenKind, email: string, ttlMs: number): Promise<string> {
  await db.delete(authTokens).where(and(eq(authTokens.userId, userId), eq(authTokens.kind, kind), isNull(authTokens.usedAt)));

  const token = generateToken();
  await db.insert(authTokens).values({
    userId,
    kind,
    email,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return token;
}

/**
 * Redeems a token: single use, checked and marked used in one UPDATE so two
 * simultaneous clicks can't both win. Null when unknown, used, expired or the wrong kind.
 */
export async function consumeAuthToken(token: string, kind: AuthTokenKind): Promise<{ userId: string; email: string } | null> {
  const [row] = await db
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authTokens.tokenHash, hashToken(token)),
        eq(authTokens.kind, kind),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date())
      )
    )
    .returning({ userId: authTokens.userId, email: authTokens.email });
  return row ?? null;
}

/** Daily cleanup of tokens that can no longer be used. Returns how many were removed. */
export async function pruneAuthTokens(): Promise<number> {
  const cutoff = new Date(Date.now() - PRUNE_GRACE_MS);
  const removed = await db
    .delete(authTokens)
    .where(or(lt(authTokens.expiresAt, cutoff), lt(authTokens.usedAt, cutoff)))
    .returning({ id: authTokens.id });
  return removed.length;
}
