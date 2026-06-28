import { Prisma } from "@prisma/client";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { TRACK_BODY_LIMIT, TRACK_RATE_LIMIT } from "../lib/constants";
import { prisma } from "../lib/db";
import { hashIp } from "../lib/ip-hash";
import { attributionCreateData } from "../lib/session";
import { parseTrackId } from "../lib/track-id";
import { ClientEventSchema } from "../schemas/events";
import { TrackRequestSchema, TrackResponseSchema } from "../schemas/track";

// POST /v1/track — funnel ingestion, beacon-tolerant.
// Upserts the Session by trackId, then inserts the batch's events deduped by
// (sessionId, clientEventId). Individual invalid events are skipped, never
// failing the batch. Responds 202 with a tiny body.
const trackRoute: FastifyPluginAsyncZod = async (app) => {
  app.post(
    "/v1/track",
    {
      bodyLimit: TRACK_BODY_LIMIT,
      config: { rateLimit: TRACK_RATE_LIMIT },
      schema: {
        tags: ["public"],
        summary: "Ingest funnel/telemetry events (accepts sendBeacon batches)",
        body: TrackRequestSchema,
        response: { 202: TrackResponseSchema },
      },
    },
    async (req, reply) => {
      const { trackId, attribution, events } = req.body;
      const now = new Date();

      // Validate-and-skip: drop malformed events instead of failing the batch.
      const valid = events.flatMap((raw) => {
        const parsed = ClientEventSchema.safeParse(raw);
        return parsed.success ? [parsed.data] : [];
      });

      // Furthest question reached in this batch, and the most recent position.
      const numbered = valid.filter(
        (e): e is typeof e & { questionNumber: number } => typeof e.questionNumber === "number",
      );
      const batchMaxQ = numbered.length ? Math.max(...numbered.map((e) => e.questionNumber)) : null;
      const lastEvent = valid.reduce<(typeof valid)[number] | null>((latest, e) => {
        if (!latest) return e;
        return (e.seq ?? 0) >= (latest.seq ?? 0) ? e : latest;
      }, null);

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
          lastQid: lastEvent?.qid ?? null,
          lastQuestionNumber: lastEvent?.questionNumber ?? null,
          maxQuestionNumber: batchMaxQ,
          startedAt: now,
          lastSeenAt: now,
        },
        update: {
          lastSeenAt: now,
          ...(lastEvent?.qid != null ? { lastQid: lastEvent.qid } : {}),
          ...(lastEvent?.questionNumber != null
            ? { lastQuestionNumber: lastEvent.questionNumber }
            : {}),
        },
      });

      // Bump maxQuestionNumber only when this batch went further (GREATEST).
      if (batchMaxQ !== null) {
        await prisma.session.updateMany({
          where: {
            id: session.id,
            OR: [{ maxQuestionNumber: null }, { maxQuestionNumber: { lt: batchMaxQ } }],
          },
          data: { maxQuestionNumber: batchMaxQ },
        });
      }

      if (valid.length > 0) {
        await prisma.event.createMany({
          data: valid.map((e) => ({
            sessionId: session.id,
            clientEventId: e.clientEventId ?? null,
            type: e.type,
            qid: e.qid ?? null,
            questionKey: e.questionKey ?? null,
            questionNumber: e.questionNumber ?? null,
            category: e.category ?? null,
            aid: e.aid ?? null,
            value: e.value != null ? String(e.value) : null,
            meta: e.meta == null ? Prisma.JsonNull : (e.meta as Prisma.InputJsonValue),
            occurredAt: e.occurredAt ?? now,
            seq: e.seq ?? null,
          })),
          skipDuplicates: true, // dedupe retried beacons via (sessionId, clientEventId)
        });
      }

      return reply.code(202).send({ ok: true });
    },
  );
};

export default trackRoute;
