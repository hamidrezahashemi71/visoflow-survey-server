import { join } from "node:path";
import autoload from "@fastify/autoload";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { env } from "./lib/env";

// Reusable application factory. Keeping this separate from `server.ts` (which
// only listens) lets tests build an app instance and use `app.inject(...)`
// without binding a port.
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: buildLoggerOptions() }).withTypeProvider<ZodTypeProvider>();

  // Route the zod schemas declared on each route through zod for runtime
  // validation (requests) and serialization (responses).
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Cross-cutting plugins (cors, helmet, rate-limit, sensible, swagger,
  // under-pressure, error handler). Loaded first so swagger and the error
  // handler are in place before any route is registered.
  await app.register(autoload, {
    dir: join(import.meta.dirname, "plugins"),
  });

  // Feature route plugins.
  await app.register(autoload, {
    dir: join(import.meta.dirname, "routes"),
  });

  return app;
}

// Pretty, human-readable logs in development; structured JSON in production;
// silent during tests.
function buildLoggerOptions(): FastifyServerOptions["logger"] {
  if (env.NODE_ENV === "test") return false;
  if (env.NODE_ENV === "production") return true;
  return {
    transport: {
      target: "pino-pretty",
      options: { translateTime: "HH:MM:ss Z", ignore: "pid,hostname" },
    },
  };
}
