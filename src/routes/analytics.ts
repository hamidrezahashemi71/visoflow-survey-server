import { Prisma } from "@prisma/client";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireAdmin } from "../lib/auth";
import { ABANDON_THRESHOLD_MS } from "../lib/constants";
import { prisma } from "../lib/db";
import { buildSessionWhere } from "../lib/query";
import { FunnelResponseSchema, OverviewResponseSchema } from "../schemas/analytics";
import { AnalyticsFilterSchema } from "../schemas/filters";

const num = (value: unknown): number => Number(value ?? 0);

// Adds drop-off "to the next step" for an ordered list of funnel steps. The
// step after the last one is "completed".
function withDropOff<T extends { viewed: number }>(
  steps: T[],
  completed: number,
): (T & { dropOff: number; dropOffRate: number })[] {
  return steps.map((step, i) => {
    const next = i + 1 < steps.length ? (steps[i + 1]?.viewed ?? 0) : completed;
    const dropOff = Math.max(0, step.viewed - next);
    const dropOffRate = step.viewed > 0 ? dropOff / step.viewed : 0;
    return { ...step, dropOff, dropOffRate };
  });
}

const analyticsRoutes: FastifyPluginAsyncZod = async (app) => {
  // ---- Funnel: abandonment analysis ----
  app.get(
    "/v1/analytics/funnel",
    {
      onRequest: requireAdmin,
      schema: {
        tags: ["admin"],
        summary: "Funnel drop-off by question number and by qid",
        security: [{ bearerAuth: [] }],
        querystring: AnalyticsFilterSchema,
        response: { 200: FunnelResponseSchema },
      },
    },
    async (req) => {
      const { from, to, campaignAid, utmSource, utmCampaign } = req.query;
      const fromV = from ?? null;
      const toV = to ?? null;
      const campV = campaignAid ?? null;
      const srcV = utmSource ?? null;
      const utmCampV = utmCampaign ?? null;
      const staleCutoff = new Date(Date.now() - ABANDON_THRESHOLD_MS);

      // Filter applied to the joined Session (alias s).
      const sFilter = Prisma.sql`
        (${fromV}::timestamptz IS NULL OR s."createdAt" >= ${fromV}::timestamptz)
        AND (${toV}::timestamptz IS NULL OR s."createdAt" <= ${toV}::timestamptz)
        AND (${campV}::text IS NULL OR s."campaignAid" = ${campV}::text)
        AND (${srcV}::text IS NULL OR s."utmSource" = ${srcV}::text)
        AND (${utmCampV}::text IS NULL OR s."utmCampaign" = ${utmCampV}::text)
      `;

      const [totals, qnRows, qidRows] = await Promise.all([
        prisma.$queryRaw<{ started: bigint; completed: bigint; abandoned: bigint }[]>(Prisma.sql`
          SELECT
            COUNT(*) AS started,
            COUNT(*) FILTER (WHERE s."status" = 'COMPLETED') AS completed,
            COUNT(*) FILTER (
              WHERE s."status" = 'IN_PROGRESS' AND s."lastSeenAt" < ${staleCutoff}::timestamptz
            ) AS abandoned
          FROM "Session" s
          WHERE ${sFilter}
        `),
        prisma.$queryRaw<{ qn: number; viewed: bigint; answered: bigint }[]>(Prisma.sql`
          SELECT e."questionNumber" AS qn,
            COUNT(DISTINCT CASE WHEN e."type" = 'QUESTION_VIEW' THEN e."sessionId" END) AS viewed,
            COUNT(DISTINCT CASE WHEN e."type" = 'ANSWER' THEN e."sessionId" END) AS answered
          FROM "Event" e JOIN "Session" s ON s."id" = e."sessionId"
          WHERE e."questionNumber" IS NOT NULL AND ${sFilter}
          GROUP BY e."questionNumber"
          ORDER BY e."questionNumber"
        `),
        prisma.$queryRaw<
          {
            qid: string;
            qn: number | null;
            question_key: string | null;
            viewed: bigint;
            answered: bigint;
          }[]
        >(Prisma.sql`
          SELECT e."qid" AS qid,
            MIN(e."questionNumber") AS qn,
            MAX(e."questionKey") AS question_key,
            COUNT(DISTINCT CASE WHEN e."type" = 'QUESTION_VIEW' THEN e."sessionId" END) AS viewed,
            COUNT(DISTINCT CASE WHEN e."type" = 'ANSWER' THEN e."sessionId" END) AS answered
          FROM "Event" e JOIN "Session" s ON s."id" = e."sessionId"
          WHERE e."qid" IS NOT NULL AND ${sFilter}
          GROUP BY e."qid"
          ORDER BY MIN(e."questionNumber") NULLS LAST, e."qid"
        `),
      ]);

      const started = num(totals[0]?.started);
      const completed = num(totals[0]?.completed);
      const abandoned = num(totals[0]?.abandoned);

      const byQuestionNumber = withDropOff(
        qnRows.map((r) => ({
          questionNumber: num(r.qn),
          viewed: num(r.viewed),
          answered: num(r.answered),
        })),
        completed,
      );

      const byQid = withDropOff(
        qidRows.map((r) => ({
          qid: r.qid,
          questionKey: r.question_key,
          questionNumber: r.qn === null ? null : num(r.qn),
          viewed: num(r.viewed),
          answered: num(r.answered),
        })),
        completed,
      );

      return {
        started,
        completed,
        abandoned,
        completionRate: started > 0 ? completed / started : 0,
        byQuestionNumber,
        byQid,
      };
    },
  );

  // ---- Overview: market snapshot ----
  app.get(
    "/v1/analytics/overview",
    {
      onRequest: requireAdmin,
      schema: {
        tags: ["admin"],
        summary: "Market snapshot: conversion by campaign/source, bands, firmographics",
        security: [{ bearerAuth: [] }],
        querystring: AnalyticsFilterSchema,
        response: { 200: OverviewResponseSchema },
      },
    },
    async (req) => {
      const sessionWhere = buildSessionWhere(req.query);
      const submissionWhere: Prisma.SubmissionWhereInput = { session: sessionWhere };

      const [
        statusGroups,
        campaignGroups,
        sourceGroups,
        bandGroups,
        pilotGroups,
        regionGroups,
        staffGroups,
        volumeGroups,
        priceGroups,
      ] = await Promise.all([
        prisma.session.groupBy({ by: ["status"], where: sessionWhere, _count: { _all: true } }),
        prisma.session.groupBy({
          by: ["campaignAid", "status"],
          where: sessionWhere,
          _count: { _all: true },
        }),
        prisma.session.groupBy({
          by: ["utmSource", "status"],
          where: sessionWhere,
          _count: { _all: true },
        }),
        prisma.submission.groupBy({ by: ["band"], where: submissionWhere, _count: { _all: true } }),
        prisma.submission.groupBy({
          by: ["pilotInterest"],
          where: submissionWhere,
          _count: { _all: true },
        }),
        prisma.submission.groupBy({
          by: ["region"],
          where: submissionWhere,
          _count: { _all: true },
        }),
        prisma.submission.groupBy({
          by: ["staffCount"],
          where: submissionWhere,
          _count: { _all: true },
        }),
        prisma.submission.groupBy({
          by: ["weeklyVolume"],
          where: submissionWhere,
          _count: { _all: true },
        }),
        prisma.submission.groupBy({
          by: ["avgPrice"],
          where: submissionWhere,
          _count: { _all: true },
        }),
      ]);

      const totalSessions = statusGroups.reduce((sum, g) => sum + g._count._all, 0);
      const totalCompleted = statusGroups.find((g) => g.status === "COMPLETED")?._count._all ?? 0;

      const foldByCampaign = (rows: { key: string | null; status: string; count: number }[]) => {
        const map = new Map<string | null, { sessions: number; completed: number }>();
        for (const r of rows) {
          const entry = map.get(r.key) ?? { sessions: 0, completed: 0 };
          entry.sessions += r.count;
          if (r.status === "COMPLETED") entry.completed += r.count;
          map.set(r.key, entry);
        }
        return [...map.entries()].map(([key, v]) => ({
          key,
          sessions: v.sessions,
          completed: v.completed,
          completionRate: v.sessions > 0 ? v.completed / v.sessions : 0,
        }));
      };

      return {
        totals: {
          sessions: totalSessions,
          completed: totalCompleted,
          completionRate: totalSessions > 0 ? totalCompleted / totalSessions : 0,
        },
        byCampaign: foldByCampaign(
          campaignGroups.map((g) => ({
            key: g.campaignAid ?? null,
            status: g.status,
            count: g._count._all,
          })),
        ),
        bySource: foldByCampaign(
          sourceGroups.map((g) => ({
            key: g.utmSource ?? null,
            status: g.status,
            count: g._count._all,
          })),
        ),
        bandDistribution: bandGroups.map((g) => ({ key: g.band ?? null, count: g._count._all })),
        pilotInterest: pilotGroups.map((g) => ({
          key: g.pilotInterest ?? null,
          count: g._count._all,
        })),
        firmographics: {
          region: regionGroups.map((g) => ({ key: g.region ?? null, count: g._count._all })),
          staffCount: staffGroups.map((g) => ({ key: g.staffCount ?? null, count: g._count._all })),
          weeklyVolume: volumeGroups.map((g) => ({
            key: g.weeklyVolume ?? null,
            count: g._count._all,
          })),
          avgPrice: priceGroups.map((g) => ({ key: g.avgPrice ?? null, count: g._count._all })),
        },
      };
    },
  );
};

export default analyticsRoutes;
