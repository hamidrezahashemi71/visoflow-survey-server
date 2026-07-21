import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The health check runs `SELECT 1`; we mock the Prisma client so tests never
// need a live database.
vi.mock("./lib/db", () => ({
  prisma: {
    $queryRaw: vi.fn().mockResolvedValue([{ result: 1 }]),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  },
}));

const { buildApp } = await import("./app");

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("GET /health", () => {
  it("returns ok and db connected", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", db: "connected" });
  });
});

describe("OpenAPI / Swagger", () => {
  it("generates a spec that includes the /health route", async () => {
    const res = await app.inject({ method: "GET", url: "/docs/json" });

    expect(res.statusCode).toBe(200);
    const spec = res.json();
    expect(spec.openapi).toBeDefined();
    expect(spec.paths["/health"]).toBeDefined();
  });

  it("documents the public ingestion routes", async () => {
    const res = await app.inject({ method: "GET", url: "/docs/json" });

    const spec = res.json();
    expect(spec.paths["/v1/phone"]?.post).toBeDefined();
    expect(spec.paths["/v1/app-interest"]?.post).toBeDefined();
  });
});
