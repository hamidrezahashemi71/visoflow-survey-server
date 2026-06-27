import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    // @fastify/autoload discovers plugin/route files with a dynamic import().
    // Inlining it routes that import() through Vite so the extensionless,
    // bundler-resolved imports inside our plugin files resolve under Vitest
    // (tsx handles this in dev; the compiled dist handles it in prod).
    server: {
      deps: {
        inline: [/@fastify\/autoload/],
      },
    },
    // Tests never touch a real database (the Prisma client is mocked), but env
    // validation runs at import time, so provide a syntactically valid env.
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://viso:viso@localhost:5432/viso_test?schema=public",
      CORS_ORIGIN: "*",
    },
  },
});
