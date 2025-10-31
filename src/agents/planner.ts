import { v4 as uuid } from "uuid";
import { TaskContractT } from "../schemas/taskContract.js";

export async function planner(goal: string, context?: string): Promise<TaskContractT> {
  const now = new Date().toISOString();
  const id = "plan_" + uuid();
  const normalized = goal.toLowerCase();
  const subtasks = [] as TaskContractT["subtasks"];

  subtasks.push({
    id: `${id}_s1`,
    description: "Collect high-quality evidence aligned with the goal",
    expectedOutput: { cards: "EvidenceCard[]" },
    dependsOn: []
  });

  if (normalized.includes("compare") || normalized.includes("versus") || normalized.includes("pros") && normalized.includes("cons")) {
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
