import underPressure from "@fastify/under-pressure";
import fp from "fastify-plugin";

// Load shedding: returns 503 when the event loop is too far behind, protecting
// the process under spikes.
export default fp(async (app) => {
  await app.register(underPressure, {
    maxEventLoopDelay: 1000,
    maxEventLoopUtilization: 0.98,
    retryAfter: 50,
  });
});
