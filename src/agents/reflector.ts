import { RunResultT } from "../schemas/runResult.js";
import { ReflectionReportT } from "../schemas/reflectionReport.js";

export async function reflector(runs: RunResultT[]): Promise<ReflectionReportT> {
  // 简化：如果没有 citations 就提示补证据
  const needs = runs.some(r => (r.citations ?? []).length === 0);
  return {
    conflicts: needs ? [{
      type: "semantic",
      tasks: runs.map(r => r.id),
      description: "No citations found; evidence coverage is insufficient.",
      severity: "medium"
    }] : [],
    optimizations: needs ? ["Call retrieve_evidence before rendering"] : [],
    severity: needs ? "medium" : "low"
  };
}
