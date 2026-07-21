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

describe("GET /v1/leads", () => {
  it("includes a phone-only abandoner (no Submission) as a lead", async () => {
    const abandonerTrackId = "visoflow-ir-lead1-survey";
    await app.inject({
      method: "POST",
      url: "/v1/phone",
      payload: { trackId: abandonerTrackId, phone: "09121234567", source: "modal" },
    });

    const res = await app.inject({ method: "GET", url: "/v1/leads", headers: adminHeaders });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.total).toBe(1);
    const lead = body.items.find((i: { trackId: string }) => i.trackId === abandonerTrackId);
    expect(lead).toBeTruthy();
    expect(lead.phone).toBe("09121234567");
    expect(lead.phoneSource).toBe("modal");
    expect(lead.status).toBe("IN_PROGRESS");
    expect(lead.hasSubmission).toBe(false);
    expect(lead.appInterest).toBe(false); // never clicked the app offer
  });

  it("surfaces the app-interest flag on a lead that clicked the offer", async () => {
    const trackId = "visoflow-ir-lead4-survey";
    await app.inject({
      method: "POST",
      url: "/v1/phone",
      payload: { trackId, phone: "09121234567" },
    });
    await app.inject({ method: "POST", url: "/v1/app-interest", payload: { trackId } });

    const res = await app.inject({ method: "GET", url: "/v1/leads", headers: adminHeaders });
    const lead = res.json().items.find((i: { trackId: string }) => i.trackId === trackId);
    expect(lead.appInterest).toBe(true);
    expect(lead.appInterestAt).not.toBeNull();
  });

  it("excludes sessions without a phone", async () => {
    await prisma.session.create({
      data: {
        trackId: "visoflow-ir-nophone-survey",
        project: "visoflow",
        language: "ir",
        type: "survey",
      },
    });

    const res = await app.inject({ method: "GET", url: "/v1/leads", headers: adminHeaders });
    expect(res.json().total).toBe(0);
  });

  it("marks a completed session with a phone as hasSubmission", async () => {
    const trackId = "visoflow-ir-lead2-survey";
    await app.inject({
      method: "POST",
      url: "/v1/submit",
      payload: {
        trackId,
        phone: "09121234567",
        answers: {},
        controllers: [],
        computed: {},
      },
    });

    const res = await app.inject({ method: "GET", url: "/v1/leads", headers: adminHeaders });
    const body = res.json();
    const lead = body.items.find((i: { trackId: string }) => i.trackId === trackId);
    expect(lead.hasSubmission).toBe(true);
    expect(lead.status).toBe("COMPLETED");
  });
});

describe("GET /v1/leads/export.csv", () => {
  it("exports leads including phone-only abandoners", async () => {
    await app.inject({
      method: "POST",
      url: "/v1/phone",
      payload: { trackId: "visoflow-ir-lead3-survey", phone: "09121234567" },
    });

    const res = await app.inject({
      method: "GET",
      url: "/v1/leads/export.csv",
      headers: adminHeaders,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.body).toContain("visoflow-ir-lead3-survey");
    expect(res.body).toContain("09121234567");
  });
});
