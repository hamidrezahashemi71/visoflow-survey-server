import sensible from "@fastify/sensible";
import fp from "fastify-plugin";

// Adds `reply.notFound()`, `httpErrors.*`, `reply.vary`, and other ergonomic
// helpers used across routes.
export default fp(async (app) => {
  await app.register(sensible);
});
