import { z } from "zod";
export const TaskContract = z.object({
  id: z.string(),
  userGoal: z.string(),
  rationale: z.string().max(1500),
  constraints: z.record(z.string(), z.any()).default({}),
  budget: z.object({ tokens: z.number().optional(), latencyMs: z.number().optional(), maxTools: z.number().optional() }).default({}),
  requiredEvidence: z.array(z.string()).default([]),
  toolsAllowlist: z.array(z.string()).default([]),
  subtasks: z.array(z.object({
    id: z.string(),
    description: z.string(),
    expectedOutput: z.any().optional(),
    dependsOn: z.array(z.string()).default([])
  })).default([]),
  createdAt: z.string()
});
export type TaskContractT = z.infer<typeof TaskContract>;
