// A single shared Prisma client for the whole app.
//
// The reference is cached on `globalThis` so that hot-reload in development
// (tsx watch) does not open a new connection pool on every restart.
//
// Note: Liara runs a normal long-lived Node server, so the standard Prisma
// client is the right choice. Edge/serverless driver adapters (e.g. the
// Postgres driver adapter) are only needed on edge runtimes and are not used
// here.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
