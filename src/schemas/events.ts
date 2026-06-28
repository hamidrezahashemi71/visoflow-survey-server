import { z } from "zod";

export const EventTypeSchema = z.enum([
  "QUIZ_START",
  "QUESTION_VIEW",
  "ANSWER",
  "NEXT",
  "BACK",
  "QUIZ_COMPLETE",
  "ABANDON",
]);
export type EventTypeName = z.infer<typeof EventTypeSchema>;

// Per-question category used by the funnel.
export const CategorySchema = z.enum(["organization", "noshow", "deposit", "closing"]);

// A single client telemetry event. This is the frontend contract; it is the
// source of truth for the sendBeacon payloads. NOTE: /v1/track validates each
// event individually and skips invalid ones (it never rejects the whole batch),
// so the values here stay deliberately permissive.
export const ClientEventSchema = z.object({
  clientEventId: z.string().nullish(), // for dedupe of retried beacons
  type: EventTypeSchema,
  qid: z.string().nullish(),
  questionKey: z.string().nullish(),
  questionNumber: z.coerce.number().int().nullish(),
  category: z.string().nullish(),
  aid: z.string().nullish(),
  value: z.union([z.string(), z.number(), z.boolean()]).nullish(),
  meta: z.record(z.unknown()).nullish(),
  occurredAt: z.coerce.date().nullish(), // client timestamp (ISO or epoch ms)
  seq: z.coerce.number().int().nullish(), // client monotonic order
});
export type ClientEvent = z.infer<typeof ClientEventSchema>;
