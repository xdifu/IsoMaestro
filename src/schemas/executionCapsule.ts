import { z } from "zod";
const ToolStep = z.object({
  kind: z.literal("tool"),
  id: z.string(),
  description: z.string(),
  tool: z.string(),
  input: z.record(z.any()).default({}),
  saveAs: z.string().optional(),
  dependsOn: z.array(z.string()).default([])
});

const SynthesizeStep = z.object({
  kind: z.literal("synthesize"),
  id: z.string(),
  description: z.string(),
  source: z.string(),
  saveAs: z.string().default("draft"),
  objective: z.string(),
  maxItems: z.number().int().min(1).max(10).default(3),
  style: z.enum(["bullet", "paragraph"]).default("bullet")
});

const StepPlanEntry = z.discriminatedUnion("kind", [ToolStep, SynthesizeStep]);

export const ExecutionCapsule = z.object({
  id: z.string(),
  taskId: z.string(),
  objective: z.string(),
  rationale: z.string(),
  stepPlan: z.array(StepPlanEntry),
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
export type ExecutionStepT = z.infer<typeof StepPlanEntry>;
