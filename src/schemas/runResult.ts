import { z } from "zod";
export const RunResult = z.object({
  id: z.string(),
  capsuleId: z.string(),
  output: z.any(),
  citations: z.array(z.string()),
  artifacts: z.array(z.string()).optional(),
  logs: z.array(z.string()).optional(),
  createdAt: z.string()
});
export type RunResultT = z.infer<typeof RunResult>;
