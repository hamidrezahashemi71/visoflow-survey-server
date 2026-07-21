import { z } from "zod";
import { AttributionSchema } from "./attribution";

// Body of POST /v1/app-interest. Sent when the respondent ticks the checkbox
// that opens the "Viso app handles everything, free" promo modal. `interested`
// defaults to true (the click itself is the signal); sending false lets the
// frontend undo an accidental tick.
export const AppInterestRequestSchema = z.object({
  trackId: z.string().min(1),
  interested: z.boolean().default(true),
  atQuestionNumber: z.coerce.number().int().nullish(),
  atQid: z.string().nullish(),
  attribution: AttributionSchema.nullish(),
});
export type AppInterestRequest = z.infer<typeof AppInterestRequestSchema>;

export const AppInterestResponseSchema = z.object({
  ok: z.literal(true),
});
export type AppInterestResponse = z.infer<typeof AppInterestResponseSchema>;
