import { z } from "zod";
export const ReflectionReport = z.object({
  conflicts: z.array(z.object({
    type: z.enum(["resource_contention","data_dependency","timing_violation","semantic"]),
    tasks: z.array(z.string()),
    description: z.string(),
    severity: z.enum(["high","medium","low"])
  })).default([]),
  optimizations: z.array(z.string()).default([]),
  severity: z.enum(["high","medium","low"]).default("low")
});
export type ReflectionReportT = z.infer<typeof ReflectionReport>;
