import cors from "@fastify/cors";
import fp from "fastify-plugin";
import { env } from "../lib/env";

// Allows the quiz frontend (and the Flutter WebView) to call this API.
export default fp(async (app) => {
  await app.register(cors, {
    origin:
      env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN.split(",").map((origin) => origin.trim()),
  });
});
