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

const trackId = "visoflow-ir-sub1-survey";

const body = {
  trackId,
  phone: "+989121234567",
  answers: {
    region: { aid: "tehran", value: "" }, // plain select -> aid is the answer
    staffCount: { aid: "", value: "10" }, // input -> value is the answer
    services: { aid: "", value: "haircut, color | spa" },
    pilotInterest: { aid: "yes", value: "" },
    role: { aid: "owner", value: "" },
  },
  controllers: [{ qid: "q1", value: "x", category: "organization", score: 5, weight: 1 }],
  computed: {
    overallScore: 72,
    band: "B",
    pillarScores: { organization: 70, noshow: 60, deposit: 80 },
    money: { monthlyLoss: 1000, recoverable: 500, freedHours: 10 },
  },
  attribution: { campaignAid: "camp1", utmSource: "instagram", utmCampaign: "spring" },
};

describe("POST /v1/submit", () => {
  it("creates a submission, completes the session, and derives curated columns", async () => {
    const res = await app.inject({ method: "POST", url: "/v1/submit", payload: body });

    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    expect(res.json().id).toBeTruthy();

    const session = await prisma.session.findUniqueOrThrow({ where: { trackId } });
    expect(session.status).toBe("COMPLETED");
    expect(session.completedAt).not.toBeNull();

    const submission = await prisma.submission.findUniqueOrThrow({
      where: { sessionId: session.id },
    });
    expect(submission.phone).toBe("+989121234567");
    expect(submission.region).toBe("tehran"); // from aid (empty value)
    expect(submission.staffCount).toBe("10"); // from value
    expect(submission.pilotInterest).toBe("yes");
    expect(submission.role).toBe("owner");
    expect(submission.services).toEqual(["haircut", "color", "spa"]);
    expect(submission.overallScore).toBe(72);
    expect(submission.band).toBe("B");

    // A QUIZ_COMPLETE event is written.
    expect(
      await prisma.event.count({ where: { sessionId: session.id, type: "QUIZ_COMPLETE" } }),
    ).toBe(1);
  });

  it("is idempotent: submitting twice updates, never duplicates", async () => {
    const first = await app.inject({ method: "POST", url: "/v1/submit", payload: body });
    const second = await app.inject({
      method: "POST",
      url: "/v1/submit",
      payload: { ...body, phone: "+989120000000" },
    });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(second.json().id).toBe(first.json().id);

    expect(await prisma.submission.count()).toBe(1);
    expect(await prisma.session.count()).toBe(1);
    // QUIZ_COMPLETE is not duplicated either.
    expect(await prisma.event.count({ where: { type: "QUIZ_COMPLETE" } })).toBe(1);

    const submission = await prisma.submission.findFirstOrThrow();
    expect(submission.phone).toBe("+989120000000"); // updated
  });

  it("succeeds with no phone and stores phone = null", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/submit",
      payload: {
        trackId: body.trackId,
        answers: body.answers,
        controllers: body.controllers,
        computed: body.computed,
        attribution: body.attribution,
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);

    const session = await prisma.session.findUniqueOrThrow({ where: { trackId } });
    expect(session.status).toBe("COMPLETED");
    const submission = await prisma.submission.findUniqueOrThrow({
      where: { sessionId: session.id },
    });
    expect(submission.phone).toBeNull();
  });

  it("treats a whitespace-only phone as absent (null)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/v1/submit",
      payload: { ...body, phone: "   " },
    });

    expect(res.statusCode).toBe(200);
    const submission = await prisma.submission.findFirstOrThrow();
    expect(submission.phone).toBeNull();
  });

  it("sets Session.phone from the submit payload (question path) when not already captured", async () => {
    await app.inject({ method: "POST", url: "/v1/submit", payload: body });

    const session = await prisma.session.findUniqueOrThrow({ where: { trackId } });
    expect(session.phone).toBe(body.phone);
    expect(session.phoneSource).toBe("question");
    expect(session.phoneCapturedAt).not.toBeNull();

    expect(
      await prisma.event.count({ where: { sessionId: session.id, type: "PHONE_CAPTURED" } }),
    ).toBe(1);
  });

  it("copies an earlier modal-captured Session.phone into the Submission when the payload carries none", async () => {
    await app.inject({
      method: "POST",
      url: "/v1/phone",
      payload: { trackId, phone: "09121110000", source: "modal" },
    });

    const res = await app.inject({
      method: "POST",
      url: "/v1/submit",
      payload: {
        trackId: body.trackId,
        answers: body.answers,
        controllers: body.controllers,
        computed: body.computed,
        attribution: body.attribution,
      },
    });

    expect(res.statusCode).toBe(200);
    const submission = await prisma.submission.findFirstOrThrow();
    expect(submission.phone).toBe("09121110000");

    // The modal capture stays the session's phone/source — submit doesn't
    // overwrite an earlier capture.
    const session = await prisma.session.findUniqueOrThrow({ where: { trackId } });
    expect(session.phone).toBe("09121110000");
    expect(session.phoneSource).toBe("modal");
  });

  it("does not overwrite an earlier modal-captured Session.phone when submit carries its own", async () => {
    await app.inject({
      method: "POST",
      url: "/v1/phone",
      payload: { trackId, phone: "09121110000", source: "modal" },
    });

    await app.inject({ method: "POST", url: "/v1/submit", payload: body });

    const submission = await prisma.submission.findFirstOrThrow();
    expect(submission.phone).toBe(body.phone); // the submitted value wins for the lead record

    const session = await prisma.session.findUniqueOrThrow({ where: { trackId } });
    expect(session.phone).toBe("09121110000"); // first-touch capture is preserved
    expect(session.phoneSource).toBe("modal");
  });
});
