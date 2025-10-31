import { ExecutionCapsuleT } from "../schemas/executionCapsule.js";
import { TaskContractT } from "../schemas/taskContract.js";
import { v4 as uuid } from "uuid";

export async function translator(contract: TaskContractT): Promise<ExecutionCapsuleT> {
  const id = "capsule_" + uuid();
  const evidenceTarget = Math.min(5, Math.max(3, contract.requiredEvidence.length || 3));
  return {
    id,
    taskId: contract.id,
    objective: contract.userGoal,
    rationale: "Translator compiled a one-shot self-contained capsule",
    stepPlan: [
      {
        kind: "tool",
        id: "collect_evidence",
        description: "Use retrieve_evidence to collect pointer-only cards",
        tool: "retrieve_evidence",
        input: {
          query: contract.userGoal,
          topK: evidenceTarget,
          filters: contract.constraints ?? {}
        },
        saveAs: "evidence",
        dependsOn: []
      },
      {
        kind: "synthesize",
        id: "draft_summary",
        description: "Produce markdown draft that cites retrieved evidence",
        source: "evidence",
        saveAs: "draft",
        objective: contract.userGoal,
        maxItems: Math.min(4, evidenceTarget),
        style: "bullet"
      },
      {
        kind: "tool",
        id: "validate_pointers",
        description: "Render and validate the draft with pointer verification",
        tool: "render_with_pointers",
        input: {
          draft: "{{draft.draft}}"
        },
        saveAs: "final",
        dependsOn: ["draft_summary"]
      }
    ],
    ioSchema: {
      type: "object",
      properties: {
        ok: { type: "boolean" },
        content: { type: "string" },
        citations: {
          type: "array",
          items: { type: "string" }
        }
      }
    },
    envSpec: {
      networkWhitelist: [],
      toolsAllowlist: ["retrieve_evidence", "render_with_pointers"],
      timeoutMs: 45000,
      cpuLimit: 1,
      memMb: 512,
      volumes: []
    },
    evidenceRefs: contract.requiredEvidence ?? [],
    guardrails: { no_fulltext: true },
    oneShot: true,
    createdAt: new Date().toISOString()
  };
}
