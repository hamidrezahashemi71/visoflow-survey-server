import type { Prisma } from "@prisma/client";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireAdmin } from "../lib/auth";
import { CSV_EXPORT_MAX } from "../lib/constants";
import { prisma } from "../lib/db";
import { buildSessionWhere } from "../lib/query";
import { SubmissionsFilterSchema, SubmissionsQuerySchema } from "../schemas/filters";
import { SubmissionListResponseSchema } from "../schemas/submissions";

type Filters = {
  band?: string;
  pilotInterest?: string;
  region?: string;
  from?: Date;
  to?: Date;
  campaignAid?: string;
  utmSource?: string;
  utmCampaign?: string;
};

function buildWhere(filters: Filters): Prisma.SubmissionWhereInput {
  return {
    ...(filters.band ? { band: filters.band } : {}),
    ...(filters.pilotInterest ? { pilotInterest: filters.pilotInterest } : {}),
    ...(filters.region ? { region: filters.region } : {}),
    session: buildSessionWhere(filters),
  };
}

const SUBMISSION_SELECT = {
  id: true,
  trackId: true,
  whatsapp: true,
  overallScore: true,
  band: true,
  pilotInterest: true,
  role: true,
  region: true,
  staffCount: true,
  weeklyVolume: true,
  avgPrice: true,
  createdAt: true,
  session: { select: { campaignAid: true, utmSource: true, utmCampaign: true } },
} satisfies Prisma.SubmissionSelect;

type SubmissionRow = Prisma.SubmissionGetPayload<{ select: typeof SUBMISSION_SELECT }>;

function toListItem(s: SubmissionRow) {
  return {
    id: s.id,
    trackId: s.trackId,
    whatsapp: s.whatsapp,
    overallScore: s.overallScore,
    band: s.band,
    pilotInterest: s.pilotInterest,
    role: s.role,
    region: s.region,
    staffCount: s.staffCount,
    weeklyVolume: s.weeklyVolume,
    avgPrice: s.avgPrice,
    campaignAid: s.session.campaignAid,
    utmSource: s.session.utmSource,
    utmCampaign: s.session.utmCampaign,
    createdAt: s.createdAt.toISOString(),
  };
}

const CSV_COLUMNS = [
  "id",
  "trackId",
  "whatsapp",
  "overallScore",
  "band",
  "pilotInterest",
  "role",
  "region",
  "staffCount",
  "weeklyVolume",
  "avgPrice",
  "campaignAid",
  "utmSource",
  "utmCampaign",
  "createdAt",
] as const;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  return /[",\n\r]/.test(str) ? `"${str.replaceAll('"', '""')}"` : str;
}

const submissionsRoutes: FastifyPluginAsyncZod = async (app) => {
  // ---- Paginated leads list ----
  app.get(
    "/v1/submissions",
    {
      onRequest: requireAdmin,
      schema: {
        tags: ["admin"],
        summary: "Paginated leads list",
        security: [{ bearerAuth: [] }],
        querystring: SubmissionsQuerySchema,
        response: { 200: SubmissionListResponseSchema },
      },
    },
    async (req) => {
      const { page, pageSize, ...filters } = req.query;
      const where = buildWhere(filters);

      const [rows, total] = await Promise.all([
        prisma.submission.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: SUBMISSION_SELECT,
        }),
        prisma.submission.count({ where }),
      ]);

      return { items: rows.map(toListItem), page, pageSize, total };
    },
  );

  // ---- CSV export for campaign follow-up ----
  app.get(
    "/v1/submissions/export.csv",
    {
      onRequest: requireAdmin,
      schema: {
        tags: ["admin"],
        summary: "Export leads as CSV",
        description: "Returns text/csv. Capped at the most recent rows.",
        security: [{ bearerAuth: [] }],
        querystring: SubmissionsFilterSchema,
      },
    },
    async (req, reply) => {
      const where = buildWhere(req.query);
      const rows = await prisma.submission.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: CSV_EXPORT_MAX,
        select: SUBMISSION_SELECT,
      });

      const lines = [CSV_COLUMNS.join(",")];
      for (const row of rows) {
        const item = toListItem(row);
        lines.push(CSV_COLUMNS.map((col) => csvCell(item[col])).join(","));
      }

      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("content-disposition", 'attachment; filename="submissions.csv"');
      return reply.send(lines.join("\n"));
    },
  );
};

export default submissionsRoutes;
