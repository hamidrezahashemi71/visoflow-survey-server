import { Prisma } from "@prisma/client";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { SUBMIT_BODY_LIMIT, SUBMIT_RATE_LIMIT } from "../lib/constants";
import { prisma } from "../lib/db";
import { deriveCuratedColumns } from "../lib/derive";
import { hashIp } from "../lib/ip-hash";
import { attributionCreateData } from "../lib/session";
import { parseTrackId } from "../lib/track-id";
import { SubmitRequestSchema, SubmitResponseSchema } from "../schemas/submit";

const asJson = (value: unknown): Prisma.InputJsonValue => value as Prisma.InputJsonValue;
const jsonOrNull = (value: unknown): Prisma.InputJsonValue | typeof Prisma.JsonNull =>
  value == null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);

// POST /v1/submit — final survey data + lead.
// Flips the Session to COMPLETED and creates-or-updates the single Submission
// keyed on the session (idempotent: re-submit updates, never duplicates).
//
// DECISION (flagged): we trust the client-computed scores/money figures, but we
// always persist the full answers/controllers/rawPayload so the server can
// recompute authoritatively later (porting the Excel scoring + money model is
// an optional follow-up, not a blocker).
const submitRoute: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/v1/submit",
    {
      bodyLimit: SUBMIT_BODY_LIMIT,
      config: { rateLimit: SUBMIT_RATE_LIMIT },
      schema: {
        tags: ["public"],
        summary: "Submit final survey answers + lead contact",
        body: SubmitRequestSchema,
        response: { 200: SubmitResponseSchema },
      },
    },
    async (req, reply) => {
      const body = req.body;
      const now = new Date();
      const { project, language, type } = parseTrackId(body.trackId);
      const userAgent = body.attribution?.userAgent ?? req.headers["user-agent"] ?? null;
      const curated = deriveCuratedColumns(body.answers);
      const { computed } = body;

      const session = await prisma.session.upsert({
        where: { trackId: body.trackId },
        create: {
          trackId: body.trackId,
          project,
          language,
          type,
          ...attributionCreateData(body.attribution),
          userAgent,
          ipHash: hashIp(req.ip),
          status: "COMPLETED",
          startedAt: now,
          lastSeenAt: now,
          completedAt: now,
        },
        update: {
          status: "COMPLETED",
          lastSeenAt: now,
          completedAt: now,
        },
      });

      // Fields shared by create and update (idempotent upsert on sessionId).
      const submissionData = {
        trackId: body.trackId,
        phone: body.phone ?? null,
        pilotInterest: curated.pilotInterest,
        role: curated.role,
        overallScore: computed.overallScore ?? null,
        band: computed.band ?? null,
        pillarScores: jsonOrNull(computed.pillarScores),
        moneyMonthlyLoss: computed.money?.monthlyLoss ?? null,
        moneyRecoverable: computed.money?.recoverable ?? null,
        moneyFreedHours: computed.money?.freedHours ?? null,
        region: curated.region,
        staffCount: curated.staffCount,
        weeklyVolume: curated.weeklyVolume,
        avgPrice: curated.avgPrice,
        noShows: curated.noShows,
        deposit: curated.deposit,
        triedSoftware: curated.triedSoftware,
        services: curated.services,
        answers: asJson(body.answers),
        controllers: asJson(body.controllers),
        rawPayload: asJson(body),
      };

      const submission = await prisma.submission.upsert({
        where: { sessionId: session.id },
        create: { sessionId: session.id, ...submissionData },
        update: submissionData,
      });

      // Funnel completion marker, idempotent via a deterministic clientEventId.
      await prisma.event.createMany({
        data: [
          {
            sessionId: session.id,
            clientEventId: "quiz-complete",
            type: "QUIZ_COMPLETE",
            occurredAt: now,
          },
        ],
        skipDuplicates: true,
      });

      return reply.code(200).send({ ok: true, id: submission.id });
    },
  );
};

export default submitRoute;
