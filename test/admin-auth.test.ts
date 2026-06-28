import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminHeaders, buildApp, prisma } from "./helpers";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

const adminRoutes = [
  "/v1/analytics/funnel",
  "/v1/analytics/overview",
  "/v1/submissions",
  "/v1/submissions/export.csv",
];

describe("admin auth", () => {
  it.each(adminRoutes)("rejects %s without a bearer token (401)", async (url) => {
    const res = await app.inject({ method: "GET", url });
    expect(res.statusCode).toBe(401);
  });

  it.each(adminRoutes)("rejects %s with a wrong token (401)", async (url) => {
    const res = await app.inject({
      method: "GET",
      url,
      headers: { authorization: "Bearer wrong-key" },
    });
    expect(res.statusCode).toBe(401);
  });

  it.each(adminRoutes)("allows %s with the correct token", async (url) => {
    const res = await app.inject({ method: "GET", url, headers: adminHeaders });
    expect(res.statusCode).toBe(200);
  });
});
