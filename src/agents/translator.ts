import { ExecutionCapsule, ExecutionCapsuleT } from "../schemas/executionCapsule.js";
import { TaskContractT } from "../schemas/taskContract.js";
import { v4 as uuid } from "uuid";
import { promptDescriptors } from "../prompts/index.js";
import { extractTextContent, trySampleMessage, isSamplingAvailable } from "../runtime/sampling.js";
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
  if (!systemText || !isSamplingAvailable()) {
    logger.debug({ msg: "translator_sampling_unavailable" });
    return null;
  }

  const payload = JSON.stringify({ contract, basePlan: base });
  const attempts = [
    { temperature: 0.2, maxTokens: 1200 },
    { temperature: 0.1, maxTokens: 900 }
  ];

  for (const [index, attempt] of attempts.entries()) {
    const request = {
      description: `translator_attempt_${index + 1}`,
      systemPrompt: `${systemText}\nRespond with valid JSON only. Do not wrap the JSON in code fences.`,
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: payload
          }
        }
      ],
      includeContext: "thisServer" as const,
      maxTokens: attempt.maxTokens,
      temperature: attempt.temperature,
      modelPreferences: {
        intelligencePriority: 0.9
      }
    };

    const result = await trySampleMessage(request);
    const text = extractTextContent(result);
    if (!text) continue;

    const cleaned = sanitiseJsonCandidate(text);
    if (!cleaned) continue;

    try {
      const raw = JSON.parse(cleaned);
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
        logger.warn({
          msg: "translator_llm_parse_failed",
          attempt: index + 1,
          issues: parsed.error.issues
        });
        continue;
      }
      if (!parsed.data.stepPlan.length) {
        logger.warn({ msg: "translator_llm_empty_plan", attempt: index + 1 });
        continue;
      }
      return parsed.data;
    } catch (error) {
      logger.warn({
        msg: "translator_llm_json_error",
        error: (error as Error).message,
        attempt: index + 1
      });
    }
  }
  return null;
}

export async function translator(contract: TaskContractT): Promise<ExecutionCapsuleT> {
  const base = buildDeterministicCapsule(contract);
  const sampled = await translatorWithSampling(contract, base);
  return sampled ?? base;
}

function sanitiseJsonCandidate(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let cleaned = trimmed.replace(/```json|```/gi, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }
  cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  return cleaned;
}
