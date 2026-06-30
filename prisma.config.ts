// Prisma CLI configuration (Prisma 6+).
//
// We stay on Prisma 6, where `url = env("DATABASE_URL")` in the datasource block
// is the correct, supported syntax. Newer Prisma VSCode extensions validate
// against Prisma 7 rules and may flag that `url` line — that warning is a
// tooling version mismatch, not a real error (`prisma validate` passes).
//
// Note: once this file exists, Prisma no longer auto-loads `.env`, so we load it
// here to keep `DATABASE_URL` available for `migrate`/`generate`. Runtime stays
// unchanged — src/lib/db.ts still reads the datasource block as before.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
});
