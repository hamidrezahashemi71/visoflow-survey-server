import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { APP_INTEREST_BODY_LIMIT, APP_INTEREST_RATE_LIMIT } from "../lib/constants";
import { prisma } from "../lib/db";
import { hashIp } from "../lib/ip-hash";
import { attributionCreateData } from "../lib/session";
import { parseTrackId } from "../lib/track-id";
import { AppInterestRequestSchema, AppInterestResponseSchema } from "../schemas/app-interest";

// POST /v1/app-interest — records that the respondent ticked the checkbox that
// opens the "Viso app handles everything, free" promo modal. Like /v1/phone the
// signal lives on the Session, so it counts even when the quiz is abandoned
// afterwards. Upserts the Session by trackId (same shape as /v1/track) and is
// idempotent: re-calling never creates a second Session, `appInterestAt` keeps
// the first click's timestamp, and the event is written once.
const appInterestRoute: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/v1/app-interest",
    {
      bodyLimit: APP_INTEREST_BODY_LIMIT,
      config: { rateLimit: APP_INTEREST_RATE_LIMIT },
      schema: {
        tags: ["public"],
        summary: 'Record interest in the "Viso app handles everything" offer',
        body: AppInterestRequestSchema,
        response: { 200: AppInterestResponseSchema },
      },
    },
    async (req, reply) => {
      const { trackId, interested, atQuestionNumber, atQid, attribution } = req.body;
      const now = new Date();

      const existing = await prisma.session.findUnique({
        where: { trackId },
        select: { appInterestAt: true },
      });
      // The first time interest is expressed — a later un-tick, or a re-tick
      // after one, never moves the timestamp or writes a second event.
      const isFirstInterest = interested && existing?.appInterestAt == null;

      const { project, language, type } = parseTrackId(trackId);
      const userAgent = attribution?.userAgent ?? req.headers["user-agent"] ?? null;

      const session = await prisma.session.upsert({
        where: { trackId },
        create: {
          trackId,
          project,
          language,
          type,
          ...attributionCreateData(attribution),
          userAgent,
          ipHash: hashIp(req.ip),
          status: "IN_PROGRESS",
          startedAt: now,
          lastSeenAt: now,
          appInterest: interested,
          appInterestAt: isFirstInterest ? now : null,
        },
        update: {
          lastSeenAt: now,
          appInterest: interested,
          ...(isFirstInterest ? { appInterestAt: now } : {}),
        },
      });

      if (isFirstInterest) {
        await prisma.event.create({
          data: {
            sessionId: session.id,
            type: "APP_INTEREST",
            qid: atQid ?? null,
            questionNumber: atQuestionNumber ?? null,
            value: "true",
            occurredAt: now,
          },
        });
      }

      return reply.code(200).send({ ok: true });
    },
  );
};

export default appInterestRoute;
