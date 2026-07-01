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

const trackId = "visoflow-ir-phn1-survey";

describe("POST /v1/phone", () => {
  it("creates a session, sets the phone, and writes a PHONE_CAPTURED event", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/phone",
      payload: {
        trackId,
        phone: "09121234567",
        source: "modal",
        atQuestionNumber: 5,
        attribution: { campaignAid: "camp1", utmSource: "instagram" },
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });

    const session = await prisma.session.findUniqueOrThrow({ where: { trackId } });
    expect(session.phone).toBe("09121234567");
    expect(session.phoneSource).toBe("modal");
    expect(session.phoneCapturedAt).not.toBeNull();
    expect(session.status).toBe("IN_PROGRESS"); // capture alone doesn't complete the quiz
    expect(session.campaignAid).toBe("camp1");

    const events = await prisma.event.findMany({
      where: { sessionId: session.id, type: "PHONE_CAPTURED" },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.questionNumber).toBe(5);
    expect(events[0]?.value).toBe("09121234567");
  });

  it("is idempotent: a second call updates the session without duplicating it or the capture event", async () => {
    const firstCapturedAt = await (async () => {
      await app.inject({
        method: "POST",
        url: "/v1/phone",
        payload: { trackId, phone: "09121234567" },
      });
      return (await prisma.session.findUniqueOrThrow({ where: { trackId } })).phoneCapturedAt;
    })();

    const res = await app.inject({
      method: "POST",
      url: "/v1/phone",
      payload: { trackId, phone: "09129999999", atQuestionNumber: 8 },
    });
    expect(res.statusCode).toBe(200);

    expect(await prisma.session.count({ where: { trackId } })).toBe(1);
    const session = await prisma.session.findUniqueOrThrow({ where: { trackId } });
    expect(session.phone).toBe("09129999999"); // latest valid wins
    expect(session.phoneCapturedAt).toEqual(firstCapturedAt); // set once, on first capture

    // Only the first capture writes an analyzable event; later updates don't.
    expect(
      await prisma.event.count({ where: { sessionId: session.id, type: "PHONE_CAPTURED" } }),
    ).toBe(1);
  });

  it("normalizes Persian digits to Latin before storing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/phone",
      payload: { trackId, phone: "۰۹۱۲۳۴۵۶۷۸۹" },
    });

    expect(res.statusCode).toBe(200);
    const session = await prisma.session.findUniqueOrThrow({ where: { trackId } });
    expect(session.phone).toBe("09123456789");
  });

  it("normalizes a +98-prefixed number without a leading zero", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/phone",
      payload: { trackId, phone: "+989121234567" },
    });

    expect(res.statusCode).toBe(200);
    const session = await prisma.session.findUniqueOrThrow({ where: { trackId } });
    expect(session.phone).toBe("09121234567");
  });

  it("rejects an invalid phone with 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/phone",
      payload: { trackId, phone: "12345" },
    });

    expect(res.statusCode).toBe(400);
    expect(await prisma.session.count()).toBe(0);
  });
});
