import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { prisma } from "../lib/db";
import { HealthResponseSchema } from "../schemas/health";

// Liveness + DB readiness check. Proves the API is up AND can reach the
// database via a cheap `SELECT 1`.
const healthRoute: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/health",
    {
      schema: {
        tags: ["system"],
        summary: "Liveness and database readiness check",
        response: {
          200: HealthResponseSchema,
        },
      },
    },
    async () => {
      await prisma.$queryRaw`SELECT 1`;
      return { status: "ok", db: "connected" } as const;
    },
  );
};

export default healthRoute;
