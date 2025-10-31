import { v4 as uuid } from "uuid";
import { TaskContract, TaskContractT } from "../schemas/taskContract.js";
import { promptDescriptors } from "../prompts/index.js";
import { extractTextContent, trySampleMessage } from "../runtime/sampling.js";
import { logger } from "../observability/logger.js";

const plannerPrompt = promptDescriptors.find((p) => p.name === "planner_system");

async function plannerWithSampling(goal: string, context?: string): Promise<TaskContractT | null> {
  const systemText = plannerPrompt?.messages[0]?.content?.[0]?.text;
  if (!systemText) return null;

  const request = {
    description: "planner",
    systemPrompt: `${systemText}\nRespond with valid JSON only. Do not wrap the JSON in code fences.`,
    messages: [
      {
        role: "user" as const,
        content: {
          type: "text" as const,
          text: JSON.stringify({ goal, context }),
        }
      }
    ],
    maxTokens: 900,
    temperature: 0.2,
    modelPreferences: {
      intelligencePriority: 0.9
    }
  };

  const response = await trySampleMessage(request);
  const text = extractTextContent(response);
  if (!text) return null;

  const json = text.includes("`") ? text.replace(/```json|```/gi, "").trim() : text.trim();
  try {
    const raw = JSON.parse(json);
    const parsed = TaskContract.safeParse(raw);
    if (!parsed.success) {
      logger.warn({ msg: "planner_llm_parse_failed", issues: parsed.error.issues });
      return null;
    }
    const current = parsed.data;
    const finalized: TaskContractT = {
      id: current.id ?? `plan_${uuid()}`,
      userGoal: current.userGoal ?? goal,
      rationale: current.rationale ?? "LLM generated plan",
      constraints: current.constraints ?? {},
      budget: current.budget ?? {},
      requiredEvidence: current.requiredEvidence ?? [],
      toolsAllowlist: current.toolsAllowlist?.length ? current.toolsAllowlist : ["retrieve_evidence", "render_with_pointers"],
      subtasks: (current.subtasks ?? []).map((s, index) => ({
        id: s.id ?? `plan_step_${index + 1}`,
        description: s.description ?? "Run subtask",
        expectedOutput: s.expectedOutput,
        dependsOn: s.dependsOn ?? []
      })),
      createdAt: current.createdAt ?? new Date().toISOString()
    };
    if (!finalized.subtasks.length) {
      logger.warn({ msg: "planner_llm_empty_subtasks" });
      return null;
    }
    return finalized;
  } catch (error) {
    logger.warn({ msg: "planner_llm_json_error", error: (error as Error).message });
    return null;
  }
}

function ruleBasedPlanner(goal: string, context?: string): TaskContractT {
  const now = new Date().toISOString();
  const id = "plan_" + uuid();
  const normalized = goal.toLowerCase();
  const subtasks: TaskContractT["subtasks"] = [];

  subtasks.push({
    id: `${id}_s1`,
    description: "Collect high-quality evidence aligned with the goal",
    expectedOutput: { cards: "EvidenceCard[]" },
    dependsOn: []
  });

  if (normalized.includes("compare") || normalized.includes("versus") || (normalized.includes("pros") && normalized.includes("cons"))) {
    subtasks.push({
      id: `${id}_s2`,
      description: "Contrast key findings and highlight trade-offs",
      expectedOutput: { outline: "Comparison" },
      dependsOn: [`${id}_s1`]
    });
  }

  subtasks.push({
    id: `${id}_s${subtasks.length + 1}`,
    description: "Draft and render the final answer with pointer citations",
    expectedOutput: { markdown: true },
    dependsOn: [`${id}_s1`]
  });

  const requiredEvidence: string[] = [];
  if (normalized.includes("statistics") || normalized.includes("data")) {
    requiredEvidence.push("fresh_statistics");
  }
  if (normalized.includes("timeline") || normalized.includes("history")) {
    requiredEvidence.push("chronology");
  }

  const constraints: Record<string, unknown> = {};
  if (context) constraints.context = context;

  return {
    id,
    userGoal: goal,
    rationale: "Decomposed by rule-based planner",
    constraints,
    budget: {},
    requiredEvidence,
    toolsAllowlist: ["retrieve_evidence", "render_with_pointers"],
    subtasks,
    createdAt: now
  };
}

export async function planner(goal: string, context?: string): Promise<TaskContractT> {
  const sampled = await plannerWithSampling(goal, context);
  if (sampled) return sampled;
  return ruleBasedPlanner(goal, context);
}
