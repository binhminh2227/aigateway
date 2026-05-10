import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import { logger } from "./logger";

// In-memory login rate limiter: max 10 attempts per email per 15 min
const loginAttempts: Record<string, { count: number; resetAt: number }> = {};
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW = 15 * 60 * 1000;

function checkLoginRateLimit(email: string): boolean {
  const now = Date.now();
  const key = email.toLowerCase();
  const entry = loginAttempts[key];
  if (!entry || entry.resetAt < now) {
    loginAttempts[key] = { count: 1, resetAt: now + LOGIN_WINDOW };
    return true;
  }
  if (entry.count >= LOGIN_LIMIT) return false;
  entry.count++;
  return true;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        if (!checkLoginRateLimit(credentials.email)) {
          logger.warn("login_rate_limited", { email: credentials.email });
          throw new Error("Too many login attempts. Try again in 15 minutes.");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) return null;

        if (user.banned) {
          logger.warn("login_banned", { email: credentials.email });
          throw new Error("Tài khoản của bạn đã bị khóa. Vui lòng liên hệ admin.");
        }

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) {
          logger.warn("login_failed", { email: credentials.email });
          return null;
        }

        logger.info("login_success", { userId: user.id });
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.refreshedAt = Date.now();
      }
      const lastRefresh = (token.refreshedAt as number) || 0;
      if (token.id && Date.now() - lastRefresh > 60_000) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, banned: true },
        });
        if (!fresh || fresh.banned) return { ...token, banned: true };
        token.role = fresh.role;
        token.refreshedAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.banned) return { expires: session.expires } as typeof session;
      if (token) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
};
