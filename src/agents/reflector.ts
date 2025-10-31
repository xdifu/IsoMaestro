import { RunResultT } from "../schemas/runResult.js";
import { ReflectionReportT } from "../schemas/reflectionReport.js";

export async function reflector(runs: RunResultT[]): Promise<ReflectionReportT> {
  const conflicts: ReflectionReportT["conflicts"] = [];
  const optimizations: string[] = [];

  for (const run of runs) {
    const citations = new Set(run.citations ?? []);
    const logs = run.logs ?? [];
    const hasEvidenceStep = logs.some(line => line.includes("collect_evidence"));
    const hasDraftStep = logs.some(line => line.includes("draft_summary"));

    if (!hasEvidenceStep) {
      conflicts.push({
        type: "data_dependency",
        tasks: [run.id],
        description: "Evidence collection step missing from execution log.",
        severity: "high"
      });
    }
    if (!hasDraftStep) {
      optimizations.push("Ensure synthesis step runs to produce a validated draft");
    }
    if (citations.size === 0) {
      conflicts.push({
        type: "semantic",
        tasks: [run.id],
        description: "Run output lacks pointer citations; cannot verify provenance.",
        severity: "high"
      });
    } else if (citations.size < 2) {
      optimizations.push("Augment answer with at least two supporting evidence pointers");
    }
    if (run.output?.ok === false) {
      conflicts.push({
        type: "semantic",
        tasks: [run.id],
        description: `Renderer flagged error: ${run.output?.error ?? "unknown"}`,
        severity: "high"
      });
    }
  }

  const severity = conflicts.some(c => c.severity === "high")
    ? "high"
    : (optimizations.length ? "medium" : "low");

  return { conflicts, optimizations, severity };
}
