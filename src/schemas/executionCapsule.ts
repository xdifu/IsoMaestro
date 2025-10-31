import { z } from "zod";
export const ExecutionCapsule = z.object({
  id: z.string(),
  taskId: z.string(),
  objective: z.string(),
  rationale: z.string(),
  stepPlan: z.array(z.string()),
  ioSchema: z.any(),
  envSpec: z.object({
    networkWhitelist: z.array(z.string()).default([]),
    toolsAllowlist: z.array(z.string()).default([]),
    timeoutMs: z.number().default(60000),
    cpuLimit: z.number().default(1),
    memMb: z.number().default(1024),
    volumes: z.array(z.object({ path: z.string(), mode: z.enum(["ro","rw"]).default("ro") })).default([])
  }),
  evidenceRefs: z.array(z.string()),
  guardrails: z.record(z.string(), z.any()).default({}),
  oneShot: z.literal(true),
  createdAt: z.string()
});
export type ExecutionCapsuleT = z.infer<typeof ExecutionCapsule>;
