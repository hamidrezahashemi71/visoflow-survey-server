import { z } from "zod";

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  db: z.literal("connected"),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
