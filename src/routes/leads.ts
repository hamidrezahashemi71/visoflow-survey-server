import type { Prisma } from "@prisma/client";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { requireAdmin } from "../lib/auth";
import { CSV_EXPORT_MAX } from "../lib/constants";
import { prisma } from "../lib/db";
import { buildSessionWhere } from "../lib/query";
import { AnalyticsFilterSchema } from "../schemas/filters";
import { LeadListResponseSchema, LeadsQuerySchema } from "../schemas/leads";

const LEAD_SELECT = {
  id: true,
  trackId: true,
  phone: true,
  phoneSource: true,
  phoneCapturedAt: true,
  status: true,
  maxQuestionNumber: true,
  campaignAid: true,
  utmSource: true,
  utmCampaign: true,
  createdAt: true,
  submission: { select: { id: true } },
} satisfies Prisma.SessionSelect;

type LeadRow = Prisma.SessionGetPayload<{ select: typeof LEAD_SELECT }>;

function toListItem(s: LeadRow) {
  return {
    id: s.id,
    trackId: s.trackId,
    phone: s.phone ?? "",
    phoneSource: s.phoneSource,
    phoneCapturedAt: s.phoneCapturedAt?.toISOString() ?? null,
    status: s.status,
    hasSubmission: s.submission != null,
    maxQuestionNumber: s.maxQuestionNumber,
    campaignAid: s.campaignAid,
    utmSource: s.utmSource,
    utmCampaign: s.utmCampaign,
    createdAt: s.createdAt.toISOString(),
  };
}

const CSV_COLUMNS = [
  "id",
  "trackId",
  "phone",
  "phoneSource",
  "phoneCapturedAt",
  "status",
  "hasSubmission",
  "maxQuestionNumber",
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

// Every session with a phone — completed (a Submission exists) or not (an
// abandoner who is still a captured lead). Complements /v1/submissions, which
// only covers completed leads.
const leadsRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/v1/leads",
    {
      onRequest: requireAdmin,
      schema: {
        tags: ["admin"],
        summary: "Paginated leads list (every session with a phone, completed or not)",
        security: [{ bearerAuth: [] }],
        querystring: LeadsQuerySchema,
        response: { 200: LeadListResponseSchema },
      },
    },
    async (req) => {
      const { page, pageSize, ...filters } = req.query;
      const where: Prisma.SessionWhereInput = {
        ...buildSessionWhere(filters),
        phone: { not: null },
      };

      const [rows, total] = await Promise.all([
        prisma.session.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          select: LEAD_SELECT,
        }),
        prisma.session.count({ where }),
      ]);

      return { items: rows.map(toListItem), page, pageSize, total };
    },
  );

  app.get(
    "/v1/leads/export.csv",
    {
      onRequest: requireAdmin,
      schema: {
        tags: ["admin"],
        summary: "Export leads as CSV (every session with a phone, completed or not)",
        description: "Returns text/csv. Capped at the most recent rows.",
        security: [{ bearerAuth: [] }],
        querystring: AnalyticsFilterSchema,
      },
    },
    async (req, reply) => {
      const where: Prisma.SessionWhereInput = {
        ...buildSessionWhere(req.query),
        phone: { not: null },
      };
      const rows = await prisma.session.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: CSV_EXPORT_MAX,
        select: LEAD_SELECT,
      });

      const lines = [CSV_COLUMNS.join(",")];
      for (const row of rows) {
        const item = toListItem(row);
        lines.push(CSV_COLUMNS.map((col) => csvCell(item[col])).join(","));
      }

      reply.header("content-type", "text/csv; charset=utf-8");
      reply.header("content-disposition", 'attachment; filename="leads.csv"');
      return reply.send(lines.join("\n"));
    },
  );
};

export default leadsRoutes;
