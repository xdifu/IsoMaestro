import { v4 as uuid } from "uuid";
import { TaskContractT } from "../schemas/taskContract.js";

export async function planner(goal: string, context?: string): Promise<TaskContractT> {
  const now = new Date().toISOString();
  // 简化：规则化拆分为 2 个子任务
  const id = "plan_" + uuid();
  return {
    id,
    userGoal: goal,
    rationale: "Decomposed by rule-based planner",
    constraints: {},
    budget: {},
    requiredEvidence: [],
    toolsAllowlist: ["retrieve_evidence","render_with_pointers"],
    subtasks: [
      { id: id+"_s1", description: "Research & collect evidence", expectedOutput: {cards: "EvidenceCard[]"}, dependsOn: [] },
      { id: id+"_s2", description: "Draft & render final answer with citations", expectedOutput: {markdown: true}, dependsOn: [id+"_s1"] }
    ],
    createdAt: now
  };
}
