import { z } from "zod";

// Shape returned by the centralized error handler. These zod schemas are the
// single source of truth and can be shared with the frontend (which also uses
// zod) to type API responses end-to-end.
export const ErrorResponseSchema = z.object({
  error: z.string(),
  message: z.string(),
});
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Validation errors additionally include the failed issues.
export const ValidationErrorResponseSchema = ErrorResponseSchema.extend({
  issues: z.array(z.unknown()).optional(),
});
export type ValidationErrorResponse = z.infer<typeof ValidationErrorResponseSchema>;
