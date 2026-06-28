import { z } from "zod";

// Campaign attribution captured on the client. Every field is optional/nullable
// so the frontend can send a partial object (or omit it entirely). Stored
// first-touch on the Session and never overwritten.
export const AttributionSchema = z.object({
  campaignAid: z.string().nullish(),
  code: z.string().nullish(),
  utmSource: z.string().nullish(),
  utmMedium: z.string().nullish(),
  utmCampaign: z.string().nullish(),
  utmContent: z.string().nullish(),
  utmTerm: z.string().nullish(),
  referrer: z.string().nullish(),
  landingPath: z.string().nullish(),
  userAgent: z.string().nullish(),
});
export type Attribution = z.infer<typeof AttributionSchema>;
