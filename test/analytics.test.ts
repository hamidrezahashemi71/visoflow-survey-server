import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { adminHeaders, buildApp, prisma, resetDb } from "./helpers";

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

// Creates a session that viewed (and answered) question numbers 1..viewedUpTo,
// optionally marked COMPLETED with a QUIZ_COMPLETE event.
async function seedSession(n: number, viewedUpTo: number, completed: boolean): Promise<void> {
  const now = new Date();
  const session = await prisma.session.create({
    data: {
      trackId: `visoflow-ir-seed${n}-survey`,
      project: "visoflow",
      language: "ir",
      type: "survey",
      campaignAid: "camp1",
      utmSource: "instagram",
      status: completed ? "COMPLETED" : "IN_PROGRESS",
      completedAt: completed ? now : null,
    },
  });

  const events = [];
  for (let q = 1; q <= viewedUpTo; q++) {
    events.push({
      sessionId: session.id,
      clientEventId: `s${n}-view-${q}`,
      type: "QUESTION_VIEW" as const,
      qid: `q${q}`,
      questionKey: `key${q}`,
      questionNumber: q,
      occurredAt: now,
    });
    events.push({
      sessionId: session.id,
      clientEventId: `s${n}-answer-${q}`,
      type: "ANSWER" as const,
      qid: `q${q}`,
      questionKey: `key${q}`,
      questionNumber: q,
      occurredAt: now,
    });
  }
  if (completed) {
    events.push({
      sessionId: session.id,
      clientEventId: `s${n}-complete`,
      type: "QUIZ_COMPLETE" as const,
      occurredAt: now,
    });
  }
  await prisma.event.createMany({ data: events });
}

describe("GET /v1/analytics/funnel", () => {
  it("computes per-question drop-off and totals", async () => {
    // 5 reach q1, 3 reach q2, 2 reach q3; 2 of them complete.
    await seedSession(1, 3, true);
    await seedSession(2, 3, true);
    await seedSession(3, 2, false);
    await seedSession(4, 1, false);
    await seedSession(5, 1, false);

    const res = await app.inject({
      method: "GET",
      url: "/v1/analytics/funnel",
      headers: adminHeaders,
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.started).toBe(5);
    expect(body.completed).toBe(2);
    expect(body.completionRate).toBeCloseTo(0.4);
    expect(body.abandoned).toBe(0); // fresh sessions are not stale

    const byQn: Record<number, { viewed: number; dropOff: number }> = {};
    for (const step of body.byQuestionNumber) {
      byQn[step.questionNumber] = { viewed: step.viewed, dropOff: step.dropOff };
    }
    expect(byQn[1]).toEqual({ viewed: 5, dropOff: 2 }); // 5 -> 3
    expect(byQn[2]).toEqual({ viewed: 3, dropOff: 1 }); // 3 -> 2
    expect(byQn[3]).toEqual({ viewed: 2, dropOff: 0 }); // 2 -> 2 completed

    // qid breakdown is present and aligned with question numbers.
    expect(body.byQid.find((s: { qid: string }) => s.qid === "q1")?.viewed).toBe(5);
  });

  it("respects campaign filters", async () => {
    await seedSession(1, 2, true);
    const res = await app.inject({
      method: "GET",
      url: "/v1/analytics/funnel?campaignAid=does-not-exist",
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().started).toBe(0);
  });
});

describe("GET /v1/analytics/overview", () => {
  it("returns conversion by campaign and band distribution", async () => {
    await seedSession(1, 3, true);
    await seedSession(2, 1, false);
    await prisma.submission.create({
      data: {
        sessionId: (await prisma.session.findFirstOrThrow({ where: { status: "COMPLETED" } })).id,
        trackId: "visoflow-ir-seed1-survey",
        phone: "+989120000000",
        band: "A",
        region: "tehran",
        answers: {},
        controllers: {},
        rawPayload: {},
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/v1/analytics/overview",
      headers: adminHeaders,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.totals.sessions).toBe(2);
    expect(body.totals.completed).toBe(1);
    expect(body.byCampaign.find((c: { key: string }) => c.key === "camp1")?.sessions).toBe(2);
    expect(body.bandDistribution.find((b: { key: string }) => b.key === "A")?.count).toBe(1);
  });
});
