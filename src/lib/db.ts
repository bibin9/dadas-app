import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: InstanceType<typeof PrismaClient> };

async function createPrismaClient() {
  if (process.env.TURSO_DATABASE_URL) {
    const { PrismaLibSql } = await import("@prisma/adapter-libsql");
    return new PrismaClient({
      adapter: new PrismaLibSql({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      }),
    });
  } else {
    const { PrismaBetterSqlite3 } = await import("@prisma/adapter-better-sqlite3");
    const path = await import("path");
    const dbPath = path.join(process.cwd(), "dev.db");
    return new PrismaClient({
      adapter: new PrismaBetterSqlite3({ url: `file:${dbPath}` }),
    });
  }
}

const prismaPromise = globalForPrisma.prisma
  ? Promise.resolve(globalForPrisma.prisma)
  : createPrismaClient().then((client) => {
      if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
      return client;
    });

export const prisma = await prismaPromise;
