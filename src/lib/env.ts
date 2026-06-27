// Validates environment variables once, at startup, and fails fast with a clear
// message if anything required is missing or malformed.
//
// Env loading: Liara (and Docker) inject real env vars, so we only load a local
// `.env` file outside production, using Node's native loader (no `dotenv`).
import { z } from "zod";

if (process.env.NODE_ENV !== "production") {
  try {
    process.loadEnvFile();
  } catch {
    // No local .env file — rely on the real environment. This is normal in CI.
  }
}

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Liara injects PORT; default is for local dev.
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default("0.0.0.0"),
  DATABASE_URL: z.string().url(),
  // Comma-separated list of allowed origins, or "*" for any.
  CORS_ORIGIN: z.string().default("*"),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
