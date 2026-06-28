import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { TEST_DATABASE_URL, TEST_SCHEMA } from "./test-env";

// Runs once before the whole Vitest suite: ensures the isolated test schema
// exists in the local dev database and syncs the Prisma schema into it.
// Requires the dev database to be running (`pnpm db:up`).
export default async function setup(): Promise<void> {
  const adminUrl = TEST_DATABASE_URL.replace(`schema=${TEST_SCHEMA}`, "schema=public");
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl } } });
  try {
    await admin.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${TEST_SCHEMA}"`);
  } catch (err) {
    throw new Error(
      `Could not reach the test database. Start it with \`pnpm db:up\`.\n${String(err)}`,
    );
  } finally {
    await admin.$disconnect();
  }

  execSync("pnpm exec prisma db push --skip-generate --accept-data-loss", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
}
