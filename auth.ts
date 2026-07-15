import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { isRateLimited } from "@/db/rate-limit";
import { getClientIp } from "@/lib/client-ip";

const LOGIN_RATE_LIMIT_MAX = 10;
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
// Shorter than NextAuth's 30-day default — this app has an admin surface, and a
// shorter session bounds how long a leaked/stale JWT stays valid.
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!username || !password) return null;

        // Rate limit login attempts per (IP, username). Keying on the username
        // alone would let an attacker lock a victim out by burning their bucket
        // with bad passwords from anywhere; combining with the caller's IP keeps
        // the victim's own IP+username bucket clean. The IP-only limit in the
        // /api/auth POST route additionally caps per-IP brute force.
        const ip = getClientIp(await headers());
        if (await isRateLimited(`${ip}:${username}`, "login", LOGIN_RATE_LIMIT_MAX, LOGIN_RATE_LIMIT_WINDOW_MS)) {
          throw new Error("Too many login attempts. Please try again later.");
        }

        const [user] = await db
          .select({
            id: users.id,
            username: users.username,
            passwordHash: users.passwordHash,
            isAdmin: users.isAdmin,
          })
          .from(users)
          .where(eq(users.username, username))
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
