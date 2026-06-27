import rateLimit from "@fastify/rate-limit";
import fp from "fastify-plugin";

// Global default limit. The public track/submit endpoints (added later) can
// tighten this per-route via the `config.rateLimit` route option.
export default fp(async (app) => {
  await app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute",
  });
});
