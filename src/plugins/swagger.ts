import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fp from "fastify-plugin";
import { jsonSchemaTransform } from "fastify-type-provider-zod";

// Generates an OpenAPI document from the zod route schemas and serves an
// interactive Swagger UI at /docs. Registered before routes (autoload loads
// plugins first) so every route is captured in the spec.
export default fp(async (app) => {
  await app.register(swagger, {
    openapi: {
      info: {
        title: "Viso API",
        description: "Viso backend API",
        version: "0.1.0",
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });
});
