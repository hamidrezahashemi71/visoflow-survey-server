import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp, prisma, resetDb } from "./helpers";

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDb();
});

const trackId = "visoflow-ir-appi-survey";

describe("POST /v1/app-interest", () => {
  it("creates a session, sets appInterest, and writes an APP_INTEREST event", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/app-interest",
      payload: {
        trackId,
        interested: true,
        atQuestionNumber: 9,
        atQid: "q9",
        attribution: { campaignAid: "camp1", utmSource: "instagram" },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const session = await prisma.session.findUniqueOrThrow({ where: { trackId } });
    expect(session.appInterest).toBe(true);
    expect(session.appInterestAt).not.toBeNull();
    expect(session.status).toBe("IN_PROGRESS"); // a click alone doesn't complete the quiz
    expect(session.campaignAid).toBe("camp1");

    const events = await prisma.event.findMany({
      where: { sessionId: session.id, type: "APP_INTEREST" },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.questionNumber).toBe(9);
    expect(events[0]?.qid).toBe("q9");
  });

  it("defaults `interested` to true when the body omits it", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/app-interest",
      payload: { trackId },
    });

    expect(res.statusCode).toBe(200);
    expect((await prisma.session.findUniqueOrThrow({ where: { trackId } })).appInterest).toBe(true);
  });

  it("is idempotent: a second call updates the session without duplicating it or the event", async () => {
    await app.inject({ method: "POST", url: "/v1/app-interest", payload: { trackId } });
    const firstInterestAt = (await prisma.session.findUniqueOrThrow({ where: { trackId } }))
      .appInterestAt;

    const res = await app.inject({
      method: "POST",
      url: "/v1/app-interest",
      payload: { trackId, interested: true, atQuestionNumber: 11 },
    });
    expect(res.statusCode).toBe(200);

    expect(await prisma.session.count({ where: { trackId } })).toBe(1);
    const session = await prisma.session.findUniqueOrThrow({ where: { trackId } });
    expect(session.appInterest).toBe(true);
    expect(session.appInterestAt).toEqual(firstInterestAt); // set once, on the first click

    expect(
      await prisma.event.count({ where: { sessionId: session.id, type: "APP_INTEREST" } }),
    ).toBe(1);
  });

  it("lets a later `interested: false` un-tick the flag without moving appInterestAt", async () => {
    await app.inject({ method: "POST", url: "/v1/app-interest", payload: { trackId } });
    const firstInterestAt = (await prisma.session.findUniqueOrThrow({ where: { trackId } }))
      .appInterestAt;

    await app.inject({
      method: "POST",
      url: "/v1/app-interest",
      payload: { trackId, interested: false },
    });

    const session = await prisma.session.findUniqueOrThrow({ where: { trackId } });
    expect(session.appInterest).toBe(false);
    expect(session.appInterestAt).toEqual(firstInterestAt);
    expect(
      await prisma.event.count({ where: { sessionId: session.id, type: "APP_INTEREST" } }),
    ).toBe(1);
  });

  it("defaults appInterest to false for a session that never sent it", async () => {
    await app.inject({
      method: "POST",
      url: "/v1/track",
      payload: { trackId, events: [] },
    });

    const session = await prisma.session.findUniqueOrThrow({ where: { trackId } });
    expect(session.appInterest).toBe(false);
    expect(session.appInterestAt).toBeNull();
  });

  it("rejects a body without a trackId with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/app-interest",
      payload: { interested: true },
    });

    expect(res.statusCode).toBe(400);
    expect(await prisma.session.count()).toBe(0);
  });
});
