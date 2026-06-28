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

const trackId = "visoflow-ir-trk1-survey";

describe("POST /v1/track", () => {
  it("creates a session with attribution and ingests events", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/track",
      payload: {
        trackId,
        attribution: { campaignAid: "camp1", utmSource: "instagram", utmCampaign: "spring" },
        events: [
          { clientEventId: "a", type: "QUESTION_VIEW", qid: "q1", questionNumber: 1, seq: 1 },
          { clientEventId: "b", type: "ANSWER", qid: "q1", questionNumber: 1, aid: "opt1", seq: 2 },
        ],
      },
    });

    expect(res.statusCode).toBe(202);
    expect(res.json()).toEqual({ ok: true });

    const session = await prisma.session.findUniqueOrThrow({ where: { trackId } });
    expect(session.campaignAid).toBe("camp1");
    expect(session.utmSource).toBe("instagram");
    expect(session.project).toBe("visoflow");
    expect(session.language).toBe("ir");
    expect(session.type).toBe("survey");
    expect(session.maxQuestionNumber).toBe(1);
    expect(session.status).toBe("IN_PROGRESS");
    expect(session.ipHash).toBeTruthy();

    expect(await prisma.event.count({ where: { sessionId: session.id } })).toBe(2);
  });

  it("dedupes repeated clientEventId across calls and advances progress", async () => {
    await app.inject({
      method: "POST",
      url: "/v1/track",
      payload: {
        trackId,
        events: [
          { clientEventId: "a", type: "QUESTION_VIEW", qid: "q1", questionNumber: 1, seq: 1 },
          { clientEventId: "b", type: "ANSWER", qid: "q1", questionNumber: 1, seq: 2 },
        ],
      },
    });

    // Second batch repeats "a" (should be ignored) and adds "c" at question 2.
    await app.inject({
      method: "POST",
      url: "/v1/track",
      payload: {
        trackId,
        events: [
          { clientEventId: "a", type: "QUESTION_VIEW", qid: "q1", questionNumber: 1, seq: 1 },
          { clientEventId: "c", type: "QUESTION_VIEW", qid: "q2", questionNumber: 2, seq: 3 },
        ],
      },
    });

    const session = await prisma.session.findUniqueOrThrow({ where: { trackId } });
    expect(await prisma.event.count({ where: { sessionId: session.id } })).toBe(3); // a, b, c
    expect(session.maxQuestionNumber).toBe(2);
    expect(session.lastQuestionNumber).toBe(2);
  });

  it("skips malformed events without failing the batch", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/track",
      payload: {
        trackId,
        events: [
          { clientEventId: "ok", type: "QUESTION_VIEW", qid: "q1", questionNumber: 1 },
          { clientEventId: "bad", type: "NOT_A_REAL_TYPE" }, // invalid enum -> skipped
        ],
      },
    });

    expect(res.statusCode).toBe(202);
    const session = await prisma.session.findUniqueOrThrow({ where: { trackId } });
    expect(await prisma.event.count({ where: { sessionId: session.id } })).toBe(1);
  });
});
