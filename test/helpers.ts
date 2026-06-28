import { buildApp } from "../src/app";
import { prisma } from "../src/lib/db";
import { ADMIN_API_KEY } from "./test-env";

// Wipe all tables between tests (the connection's search_path is the test schema).
export async function resetDb(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Event", "Submission", "Session" RESTART IDENTITY CASCADE',
  );
}

export const adminHeaders = { authorization: `Bearer ${ADMIN_API_KEY}` };

export { buildApp, prisma };
