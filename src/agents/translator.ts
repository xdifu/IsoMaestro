import { ExecutionCapsule, ExecutionCapsuleT } from "../schemas/executionCapsule.js";
import { TaskContractT } from "../schemas/taskContract.js";
import { v4 as uuid } from "uuid";
import { promptDescriptors } from "../prompts/index.js";
import { extractTextContent, trySampleMessage } from "../runtime/sampling.js";
import { logger } from "../observability/logger.js";

const translatorPrompt = promptDescriptors.find((p) => p.name === "translator_system");

function buildDeterministicCapsule(contract: TaskContractT, capsuleId?: string): ExecutionCapsuleT {
  const id = capsuleId ?? "capsule_" + uuid();
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

async function translatorWithSampling(contract: TaskContractT, base: ExecutionCapsuleT): Promise<ExecutionCapsuleT | null> {
  const systemText = translatorPrompt?.messages[0]?.content?.[0]?.text;
  if (!systemText) return null;

  const request = {
    description: "translator",
    systemPrompt: `${systemText}\nRespond with valid JSON only. Do not wrap the JSON in code fences.`,
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: JSON.stringify({ contract, basePlan: base })
        }
      }
    ],
    maxTokens: 1200,
    temperature: 0.2,
    modelPreferences: {
      intelligencePriority: 0.9
    }
  };

  const result = await trySampleMessage(request);
  const text = extractTextContent(result);
  if (!text) return null;
  const json = text.includes("`") ? text.replace(/```json|```/gi, "").trim() : text.trim();

  try {
    const raw = JSON.parse(json);
    const merged = {
      ...base,
      ...raw,
      envSpec: { ...base.envSpec, ...(raw.envSpec ?? {}) },
      guardrails: { ...base.guardrails, ...(raw.guardrails ?? {}) },
      evidenceRefs: raw.evidenceRefs ?? base.evidenceRefs,
      stepPlan: raw.stepPlan ?? base.stepPlan
    };
    const parsed = ExecutionCapsule.safeParse(merged);
    if (!parsed.success) {
      logger.warn({ msg: "translator_llm_parse_failed", issues: parsed.error.issues });
      return null;
    }
    return parsed.data;
  } catch (error) {
    logger.warn({ msg: "translator_llm_json_error", error: (error as Error).message });
    return null;
  }
}

export async function translator(contract: TaskContractT): Promise<ExecutionCapsuleT> {
  const base = buildDeterministicCapsule(contract);
  const sampled = await translatorWithSampling(contract, base);
  return sampled ?? base;
}
