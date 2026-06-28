import { z } from "zod";

// Shared query filters for the admin analytics/submissions endpoints. Query
// params arrive as strings; zod coerces dates.
export const AnalyticsFilterSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  campaignAid: z.string().optional(),
  utmSource: z.string().optional(),
  utmCampaign: z.string().optional(),
});
export type AnalyticsFilter = z.infer<typeof AnalyticsFilterSchema>;

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

// Submissions list/export filters: analytics filters + lead-level facets.
export const SubmissionsFilterSchema = AnalyticsFilterSchema.extend({
  band: z.string().optional(),
  pilotInterest: z.string().optional(),
  region: z.string().optional(),
});
export type SubmissionsFilter = z.infer<typeof SubmissionsFilterSchema>;

export const SubmissionsQuerySchema = SubmissionsFilterSchema.merge(PaginationSchema);
