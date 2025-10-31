import { ExecutionCapsuleT } from "../schemas/executionCapsule.js";
import { TaskContractT } from "../schemas/taskContract.js";
import { v4 as uuid } from "uuid";

export async function translator(contract: TaskContractT): Promise<ExecutionCapsuleT> {
  const id = "capsule_" + uuid();
  const evidenceTarget = Math.min(5, Math.max(3, contract.requiredEvidence.length || 3));
  const iso = {
    collect1: `iso_${uuid()}`,
    collect2: `iso_${uuid()}`,
    synth: `iso_${uuid()}`,
    validate: `iso_${uuid()}`
  };
  return {
    id,
    taskId: contract.id,
    objective: contract.userGoal,
    rationale: "Translator compiled a one-shot self-contained capsule",
    stepPlan: [
      {
        kind: "tool",
        id: "collect_primary",
        description: "Use retrieve_evidence to collect pointer-only cards",
        tool: "retrieve_evidence",
        input: {
          query: contract.userGoal,
          topK: evidenceTarget,
          filters: contract.constraints ?? {}
        },
        saveAs: "evidence_primary",
        dependsOn: [],
        isolationId: iso.collect1
      },
      {
        kind: "tool",
        id: "collect_secondary",
        description: "Complementary retrieval with relaxed filters",
        tool: "retrieve_evidence",
        input: {
          query: contract.userGoal + " pointers",
          topK: Math.max(2, Math.floor(evidenceTarget / 2)),
          filters: {}
        },
        saveAs: "evidence_secondary",
        dependsOn: [],
        isolationId: iso.collect2
      },
      {
        kind: "synthesize",
        id: "draft_summary",
        description: "Produce markdown draft that cites retrieved evidence",
        source: "evidence_primary,evidence_secondary",
        saveAs: "draft",
        objective: contract.userGoal,
        maxItems: Math.min(4, evidenceTarget),
        style: "bullet",
        dependsOn: ["collect_primary", "collect_secondary"],
        isolationId: iso.synth
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
        dependsOn: ["draft_summary"],
        isolationId: iso.validate
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
      maxParallel: 4,
      volumes: []
    },
    evidenceRefs: contract.requiredEvidence ?? [],
    guardrails: { no_fulltext: true },
    oneShot: true,
    createdAt: new Date().toISOString()
  };
}
