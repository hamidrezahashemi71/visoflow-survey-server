import { defineConfig } from "tsup";

// Production build. We compile the whole `src` tree (preserving the directory
// structure) rather than a single bundle, because @fastify/autoload discovers
// plugin/route files on disk at runtime (dist/plugins/*, dist/routes/*).
// node_modules dependencies are left external (the default for the "node"
// platform), so the runtime resolves them from a `pnpm install --prod` tree.
export default defineConfig({
  entry: ["src/**/*.ts", "!src/**/*.test.ts"],
  outDir: "dist",
  format: ["esm"],
  target: "node22",
  platform: "node",
  splitting: true,
  sourcemap: true,
  clean: true,
  dts: false,
});
