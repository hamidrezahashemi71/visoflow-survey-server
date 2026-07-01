import { z } from "zod";
import { normalizePhone } from "../lib/phone";
import { AttributionSchema } from "./attribution";

export const PhoneSourceSchema = z.enum(["modal", "question"]);
export type PhoneSource = z.infer<typeof PhoneSourceSchema>;

// Body of POST /v1/phone. `phone` is normalized to `09XXXXXXXXX` server-side
// (defense in depth — the frontend modal should already validate) and the
// request fails validation (400) when it isn't a plausible Iranian mobile
// number.
export const PhoneCaptureRequestSchema = z.object({
  trackId: z.string().min(1),
  phone: z
    .string()
    .min(1)
    .transform((value, ctx) => {
      const normalized = normalizePhone(value);
      if (!normalized) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "phone must be a valid Iranian mobile number",
        });
        return z.NEVER;
      }
      return normalized;
    }),
  source: PhoneSourceSchema.default("modal"),
  atQuestionNumber: z.coerce.number().int().nullish(),
  atQid: z.string().nullish(),
  attribution: AttributionSchema.nullish(),
});
export type PhoneCaptureRequest = z.infer<typeof PhoneCaptureRequestSchema>;

export const PhoneCaptureResponseSchema = z.object({
  ok: z.literal(true),
});
export type PhoneCaptureResponse = z.infer<typeof PhoneCaptureResponseSchema>;
