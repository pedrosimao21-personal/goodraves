import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { isRateLimited } from "@/db/rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { looksLikeEmail, normalizeEmail } from "@/lib/email-address";

const LOGIN_RATE_LIMIT_MAX = 10;
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
// Shorter than NextAuth's 30-day default — this app has an admin surface, and a
// shorter session bounds how long a leaked/stale JWT stays valid.
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        // Holds a username or an email address.
        username: { label: "Username or email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const identifier = (credentials?.username as string | undefined)?.trim();
        const password = credentials?.password as string | undefined;

        if (!identifier || !password) return null;

        // Rate limit login attempts per (IP, username). Keying on the username
        // alone would let an attacker lock a victim out by burning their bucket
        // with bad passwords from anywhere; combining with the caller's IP keeps
        // the victim's own IP+username bucket clean. The IP-only limit in the
        // /api/auth POST route additionally caps per-IP brute force.
        const ip = getClientIp(await headers());
        if (await isRateLimited(`${ip}:${identifier.toLowerCase()}`, "login", LOGIN_RATE_LIMIT_MAX, LOGIN_RATE_LIMIT_WINDOW_MS)) {
          throw new Error("Too many login attempts. Please try again later.");
        }

        // An email only logs in once verified, so typing someone else's address at sign-up gets no access to their account.
        const email = looksLikeEmail(identifier) ? normalizeEmail(identifier) : null;
        if (looksLikeEmail(identifier) && !email) return null;
        const [user] = await db
          .select({
            id: users.id,
            username: users.username,
            passwordHash: users.passwordHash,
            isAdmin: users.isAdmin,
          })
          .from(users)
          .where(email ? and(sql`lower(${users.email}) = ${email}`, isNotNull(users.emailVerifiedAt)) : eq(users.username, identifier))
          .limit(1);

        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, name: user.username, isAdmin: user.isAdmin } as any;
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE_SECONDS,
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        (token as any).isAdmin = (user as any).isAdmin ?? false;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        (session.user as any).isAdmin = (token as any).isAdmin ?? false;
      }
      return session;
    },
  },
});
