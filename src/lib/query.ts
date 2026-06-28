import type { Prisma } from "@prisma/client";
import type { AnalyticsFilter } from "../schemas/filters";

// Translates the shared analytics filters into a Prisma Session `where`. Reused
// directly for Session queries and nested under `{ session: ... }` for
// Submission queries.
export function buildSessionWhere(filter: AnalyticsFilter): Prisma.SessionWhereInput {
  const where: Prisma.SessionWhereInput = {};

  if (filter.from || filter.to) {
    where.createdAt = {
      ...(filter.from ? { gte: filter.from } : {}),
      ...(filter.to ? { lte: filter.to } : {}),
    };
  }
  if (filter.campaignAid) where.campaignAid = filter.campaignAid;
  if (filter.utmSource) where.utmSource = filter.utmSource;
  if (filter.utmCampaign) where.utmCampaign = filter.utmCampaign;

  return where;
}
