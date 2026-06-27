import type { FastifyError } from "fastify";
import fp from "fastify-plugin";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from "fastify-type-provider-zod";

// Centralized, zod-aware error handler.
// - Request validation failures  -> clean 400 with the failing issues.
// - Response serialization bugs   -> safe 500 (never leak internal shapes).
// - http-errors / sensible (4xx)  -> pass through their status + message.
// - Everything else (5xx)         -> logged, generic 500.
export default fp(async (app) => {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.code(400).send({
        error: "Bad Request",
        message: "Request does not match the expected schema",
        issues: error.validation,
      });
    }

    if (isResponseSerializationError(error)) {
      request.log.error({ err: error }, "Response serialization error");
      return reply.code(500).send({
        error: "Internal Server Error",
        message: "The response did not match the expected schema",
      });
    }

    const statusCode = error.statusCode ?? 500;

    if (statusCode >= 500) {
      request.log.error({ err: error }, "Unhandled error");
      return reply.code(500).send({
        error: "Internal Server Error",
        message: "Something went wrong",
      });
    }

    // Client errors (e.g. from @fastify/sensible / @fastify/rate-limit).
    return reply.code(statusCode).send({
      error: error.name,
      message: error.message,
    });
  });
});
