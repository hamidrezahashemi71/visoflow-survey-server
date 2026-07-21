import { z } from "zod";
import { AnalyticsFilterSchema, PaginationSchema } from "./filters";

// Every session with a phone (completed or not) — the phone-capture-first view
// of leads, independent of whether a Submission exists.
export const LeadListItemSchema = z.object({
  id: z.string(),
  trackId: z.string(),
  phone: z.string(),
  phoneSource: z.string().nullable(),
  phoneCapturedAt: z.string().nullable(), // ISO 8601
  appInterest: z.boolean(), // ticked the "Viso app handles everything" offer
  appInterestAt: z.string().nullable(), // ISO 8601
  status: z.enum(["IN_PROGRESS", "COMPLETED"]),
  hasSubmission: z.boolean(),
  maxQuestionNumber: z.number().int().nullable(),
  campaignAid: z.string().nullable(),
  utmSource: z.string().nullable(),
  utmCampaign: z.string().nullable(),
  createdAt: z.string(), // ISO 8601
});
export type LeadListItem = z.infer<typeof LeadListItemSchema>;

export const LeadListResponseSchema = z.object({
  items: z.array(LeadListItemSchema),
  page: z.number().int(),
  pageSize: z.number().int(),
  total: z.number().int(),
});
export type LeadListResponse = z.infer<typeof LeadListResponseSchema>;

export const LeadsQuerySchema = AnalyticsFilterSchema.merge(PaginationSchema);
export type LeadsQuery = z.infer<typeof LeadsQuerySchema>;
