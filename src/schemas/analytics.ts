import { z } from "zod";

// ---- Funnel (abandonment analysis) ----

export const FunnelStepSchema = z.object({
  questionNumber: z.number().int(),
  viewed: z.number().int(), // distinct sessions that reached/viewed this step
  answered: z.number().int(), // distinct sessions that answered it
  dropOff: z.number().int(), // sessions lost before the next step
  dropOffRate: z.number(), // dropOff / viewed (0..1)
});

export const FunnelQidStepSchema = z.object({
  qid: z.string(),
  questionKey: z.string().nullable(),
  questionNumber: z.number().int().nullable(),
  viewed: z.number().int(),
  answered: z.number().int(),
  dropOff: z.number().int(),
  dropOffRate: z.number(),
});

export const FunnelResponseSchema = z.object({
  started: z.number().int(),
  completed: z.number().int(),
  abandoned: z.number().int(), // IN_PROGRESS + stale (derived, not stored)
  completionRate: z.number(),
  byQuestionNumber: z.array(FunnelStepSchema),
  byQid: z.array(FunnelQidStepSchema),
});
export type FunnelResponse = z.infer<typeof FunnelResponseSchema>;

// ---- Overview (market snapshot) ----

const CountByKeySchema = z.object({
  key: z.string().nullable(),
  count: z.number().int(),
});

const CampaignStatSchema = z.object({
  key: z.string().nullable(),
  sessions: z.number().int(),
  completed: z.number().int(),
  completionRate: z.number(),
});

export const OverviewResponseSchema = z.object({
  totals: z.object({
    sessions: z.number().int(),
    completed: z.number().int(),
    completionRate: z.number(),
    phoneCaptured: z.number().int(), // sessions with a phone, completed or not
    phoneCaptureRate: z.number(),
  }),
  byCampaign: z.array(CampaignStatSchema),
  bySource: z.array(CampaignStatSchema),
  bandDistribution: z.array(CountByKeySchema),
  pilotInterest: z.array(CountByKeySchema),
  firmographics: z.object({
    region: z.array(CountByKeySchema),
    staffCount: z.array(CountByKeySchema),
    weeklyVolume: z.array(CountByKeySchema),
    avgPrice: z.array(CountByKeySchema),
  }),
});
export type OverviewResponse = z.infer<typeof OverviewResponseSchema>;
