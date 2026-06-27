import helmet from "@fastify/helmet";
import fp from "fastify-plugin";

// Security headers. The Content-Security-Policy is widened just enough for the
// Swagger UI at /docs (which uses inline scripts/styles) to render.
export default fp(async (app) => {
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "img-src": ["'self'", "data:", "validator.swagger.io"],
        "script-src": ["'self'", "'unsafe-inline'"],
        "style-src": ["'self'", "'unsafe-inline'"],
      },
    },
  });
});
