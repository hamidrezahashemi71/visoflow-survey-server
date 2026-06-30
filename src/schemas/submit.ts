import { z } from "zod";
import { AttributionSchema } from "./attribution";

// { [questionKey]: { aid, value } } — value is filled for inputs/controllers,
// empty for plain selects (where `aid` is the chosen option).
export const AnswerValueSchema = z.object({
  aid: z.string().nullish(),
  value: z.union([z.string(), z.number(), z.boolean()]).nullish(),
});
export const AnswersSchema = z.record(AnswerValueSchema);
export type Answers = z.infer<typeof AnswersSchema>;

// Raw controller rows from the client.
export const ControllerSchema = z.object({
  qid: z.string().nullish(),
  value: z.union([z.string(), z.number(), z.boolean()]).nullish(),
  category: z.string().nullish(),
  score: z.coerce.number().nullish(),
  weight: z.coerce.number().nullish(),
});

export const PillarScoresSchema = z.object({
  organization: z.coerce.number().nullish(),
  noshow: z.coerce.number().nullish(),
  deposit: z.coerce.number().nullish(),
});

export const MoneyModelSchema = z.object({
  monthlyLoss: z.coerce.number().nullish(),
  recoverable: z.coerce.number().nullish(),
  freedHours: z.coerce.number().nullish(),
});

export const ComputedSchema = z.object({
  overallScore: z.coerce.number().min(0).max(100).nullish(),
  band: z.string().nullish(),
  pillarScores: PillarScoresSchema.nullish(),
  money: MoneyModelSchema.nullish(),
});

// Optional lead phone. Empty/whitespace is treated as absent (a submit with no
// phone must succeed); when present it's trimmed and gets a lenient sanity check
// so we never hard-block a lead over formatting.
export const PhoneSchema = z
  .string()
  .optional()
  .transform((value) => value?.trim())
  .transform((value) => (value ? value : undefined))
  .refine((value) => value === undefined || (value.length >= 4 && value.length <= 32), {
    message: "phone must be 4–32 characters when provided",
  });

// Body of POST /v1/submit — strict validation (this is the qualified lead).
export const SubmitRequestSchema = z.object({
  trackId: z.string().min(1),
  phone: PhoneSchema,
  answers: AnswersSchema,
  controllers: z.array(ControllerSchema).default([]),
  computed: ComputedSchema,
  attribution: AttributionSchema.nullish(),
});
export type SubmitRequest = z.infer<typeof SubmitRequestSchema>;

export const SubmitResponseSchema = z.object({
  ok: z.literal(true),
  id: z.string(),
});
export type SubmitResponse = z.infer<typeof SubmitResponseSchema>;
