import { z } from "zod";
import { AttributionSchema } from "./attribution";

// Body of POST /v1/track. Events are accepted as a loose array and validated
// per-item in the handler (validate-and-skip), so one malformed event never
// fails the batch. See ClientEventSchema in ./events for the expected shape.
export const TrackRequestSchema = z.object({
  trackId: z.string().min(1),
  attribution: AttributionSchema.nullish(),
  events: z.array(z.record(z.unknown())).default([]),
});
export type TrackRequest = z.infer<typeof TrackRequestSchema>;

// Tiny acknowledgement body (sent with 202).
export const TrackResponseSchema = z.object({
  ok: z.literal(true),
});
export type TrackResponse = z.infer<typeof TrackResponseSchema>;
