import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrisma() {
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
  const relativePath = dbUrl.replace(/^file:/, "");
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const adapter = new PrismaBetterSqlite3({ url: `file:${absolutePath}` });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient({ adapter } as any);
}

// Cache on globalThis in ALL environments to prevent connection leak on hot-reload and serverless re-invocation
export const prisma = globalForPrisma.prisma ?? createPrisma();
globalForPrisma.prisma = prisma;
