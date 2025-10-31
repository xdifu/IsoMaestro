import { ExecutionCapsuleT } from "../schemas/executionCapsule.js";
import { TaskContractT } from "../schemas/taskContract.js";
import { v4 as uuid } from "uuid";

export async function translator(contract: TaskContractT): Promise<ExecutionCapsuleT> {
  const id = "capsule_" + uuid();
  const first = contract.subtasks[0];
  return {
    id,
    taskId: contract.id,
    objective: contract.userGoal,
    rationale: "Translator compiled a one-shot self-contained capsule",
    stepPlan: [
      "Use retrieve_evidence to collect pointer-only cards",
      "Produce output shaped by ioSchema; do not embed full texts",
      "Return citations as ev:// pointers"
    ],
    ioSchema: { type: "object", properties: { cards: { type: "array" } } },
    envSpec: {
      networkWhitelist: [],
      toolsAllowlist: ["retrieve_evidence"],
      timeoutMs: 45000,
      cpuLimit: 1,
      memMb: 512,
      volumes: []
    },
    evidenceRefs: [],
    guardrails: { no_fulltext: true },
    oneShot: true,
    createdAt: new Date().toISOString()
  };
}
