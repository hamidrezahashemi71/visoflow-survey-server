import { defineConfig } from "vitest/config";
import { ADMIN_API_KEY, IP_HASH_SALT, TEST_DATABASE_URL } from "./test/test-env";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // Integration tests share one Postgres schema, so run files sequentially to
    // avoid cross-file interference (each test resets the tables it uses).
    fileParallelism: false,
    // Create the test schema + tables once before the suite.
    globalSetup: ["./test/global-setup.ts"],
    // @fastify/autoload discovers plugin/route files with a dynamic import().
    // Inlining it routes that import() through Vite so the extensionless,
    // bundler-resolved imports inside our plugin files resolve under Vitest
    // (tsx handles this in dev; the compiled dist handles it in prod).
    server: {
      deps: {
        inline: [/@fastify\/autoload/],
      },
    },
    // env validation runs at import time; unit tests mock Prisma, integration
    // tests use the test schema above.
    env: {
      NODE_ENV: "test",
      DATABASE_URL: TEST_DATABASE_URL,
      CORS_ORIGIN: "*",
      ADMIN_API_KEY,
      IP_HASH_SALT,
    },
  },
});
