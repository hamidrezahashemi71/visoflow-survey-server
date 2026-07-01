import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { PHONE_BODY_LIMIT, PHONE_RATE_LIMIT } from "../lib/constants";
import { prisma } from "../lib/db";
import { hashIp } from "../lib/ip-hash";
import { attributionCreateData } from "../lib/session";
import { parseTrackId } from "../lib/track-id";
import { PhoneCaptureRequestSchema, PhoneCaptureResponseSchema } from "../schemas/phone";

// POST /v1/phone — early, standalone lead capture.
// The frontend's phone modal can appear at any point in the quiz (A/B-driven),
// so the phone is captured on the Session itself rather than waiting for
// /v1/submit — someone who gives their number and then abandons is still a
// captured lead. Upserts the Session by trackId (same shape as /v1/track) and
// is idempotent: re-calling never creates a second Session, and the capture
// event is only written once, on the first successful capture.
const phoneRoute: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/v1/phone",
    {
      bodyLimit: PHONE_BODY_LIMIT,
      config: { rateLimit: PHONE_RATE_LIMIT },
      schema: {
        tags: ["public"],
        summary: "Capture a lead phone number (e.g. from the phone modal)",
        body: PhoneCaptureRequestSchema,
        response: { 200: PhoneCaptureResponseSchema },
      },
    },
    async (req, reply) => {
      const { trackId, phone, source, atQuestionNumber, atQid, attribution } = req.body;
      const now = new Date();

      const existing = await prisma.session.findUnique({
        where: { trackId },
        select: { phoneCapturedAt: true },
      });
      const isFirstCapture = existing?.phoneCapturedAt == null;

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
          phone,
          phoneSource: source,
          phoneCapturedAt: now,
        },
        update: {
          lastSeenAt: now,
          phone,
          phoneSource: source,
          ...(isFirstCapture ? { phoneCapturedAt: now } : {}),
        },
      });

      if (isFirstCapture) {
        await prisma.event.create({
          data: {
            sessionId: session.id,
            type: "PHONE_CAPTURED",
            qid: atQid ?? null,
            questionNumber: atQuestionNumber ?? null,
            value: phone,
            occurredAt: now,
          },
        });
      }

      return reply.code(200).send({ ok: true });
    },
  );
};

export default phoneRoute;
