import { z } from "zod";

// A row in the leads list / CSV export.
export const SubmissionListItemSchema = z.object({
  id: z.string(),
  trackId: z.string(),
  whatsapp: z.string(),
  overallScore: z.number().nullable(),
  band: z.string().nullable(),
  pilotInterest: z.string().nullable(),
  role: z.string().nullable(),
  region: z.string().nullable(),
  staffCount: z.string().nullable(),
  weeklyVolume: z.string().nullable(),
  avgPrice: z.string().nullable(),
  campaignAid: z.string().nullable(),
  utmSource: z.string().nullable(),
  utmCampaign: z.string().nullable(),
  createdAt: z.string(), // ISO 8601
});
export type SubmissionListItem = z.infer<typeof SubmissionListItemSchema>;

export const SubmissionListResponseSchema = z.object({
  items: z.array(SubmissionListItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type SubmissionListResponse = z.infer<typeof SubmissionListResponseSchema>;
