import { ExecutionCapsuleT, ExecutionStepT } from "../schemas/executionCapsule.js";
import { SandboxResult } from "./types.js";
import { retrieveEvidence } from "../tools/retrieveEvidence.js";
import { renderWithPointers } from "../tools/renderWithPointers.js";

type StepOutputs = Map<string, any>;

const TOOL_EXECUTORS: Record<string, (input: any) => Promise<any>> = {
  retrieve_evidence: retrieveEvidence,
  render_with_pointers: renderWithPointers
};

function resolvePath(path: string, outputs: StepOutputs): any {
  const [root, ...rest] = path.split(".");
  const base = outputs.get(root);
  return rest.reduce((acc, key) => (acc == null ? acc : acc[key]), base);
}

function resolveTemplatedInput(input: any, outputs: StepOutputs): any {
  if (typeof input === "string") {
    const match = input.match(/^\{\{(.+)\}\}$/);
    if (match) {
      const resolved = resolvePath(match[1], outputs);
      if (typeof resolved === "undefined") {
        throw new Error(`PLACEHOLDER_UNRESOLVED:${match[1]}`);
      }
      return resolved;
    }
    return input;
  }
  if (Array.isArray(input)) {
    return input.map(item => resolveTemplatedInput(item, outputs));
  }
  if (input && typeof input === "object") {
    const clone: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input)) {
      clone[key] = resolveTemplatedInput(value, outputs);
    }
    return clone;
  }
  return input;
}

async function executeToolStep(step: Extract<ExecutionStepT, { kind: "tool" }>, capsule: ExecutionCapsuleT, outputs: StepOutputs, logs: string[]) {
  if (!capsule.envSpec.toolsAllowlist.includes(step.tool)) {
    throw new Error(`TOOL_NOT_ALLOWED:${step.tool}`);
  }
  const executor = TOOL_EXECUTORS[step.tool];
  if (!executor) {
    throw new Error(`TOOL_NOT_IMPLEMENTED:${step.tool}`);
  }
  const resolvedInput = resolveTemplatedInput(step.input, outputs);
  logs.push(`step:start id=${step.id} tool=${step.tool}`);
  const result = await executor(resolvedInput);
  const key = step.saveAs ?? step.id;
  outputs.set(key, result);
  logs.push(`step:complete id=${step.id}`);
}

function synthesiseDraft(step: Extract<ExecutionStepT, { kind: "synthesize" }>, outputs: StepOutputs, logs: string[]) {
  // Allow multiple sources separated by comma, merge items
  const keys = step.source.split(",").map(s => s.trim()).filter(Boolean);
  const coll: any[] = [];
  for (const key of keys) {
    const src = outputs.get(key);
    if (!src) continue;
    const arr = src.items ?? src.cards ?? [];
    if (Array.isArray(arr)) coll.push(...arr);
  }
  if (coll.length === 0) {
    throw new Error(`SYNTHESIS_SOURCE_MISSING:${step.source}`);
  }
  const items = coll;
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("SYNTHESIS_NO_EVIDENCE");
  }
  const selected = items.slice(0, step.maxItems);
  const lines = selected.map(card => {
    const pointer = card.id ?? card.pointer ?? "";
    const summary = (card.summary ?? card.text ?? "").trim();
    return step.style === "paragraph"
      ? `${summary} [ref:${pointer}]`
      : `- ${summary} [ref:${pointer}]`;
  });
  const body = step.style === "paragraph" ? lines.join(" ") : lines.join("\n");
  const draft = `### ${step.objective}\n\n${body}`;
  const result = {
    draft,
    citations: selected.map((card: any) => card.id ?? card.pointer).filter(Boolean),
    sourceItems: selected
  };
  outputs.set(step.saveAs ?? step.id, result);
  logs.push(`step:complete id=${step.id} synthesize`);
}

export const sandboxRunner = {
  async run(capsule: ExecutionCapsuleT): Promise<{ id: string; capsuleId: string; output: any; citations: string[]; artifacts: string[]; logs: string[]; createdAt: string; }> {
    const logs: string[] = [];
    logs.push(`sandbox:start capsule=${capsule.id}`);
    logs.push(`sandbox:tools ${capsule.envSpec.toolsAllowlist.join(",")}`);
    const outputs: StepOutputs = new Map();

    // Build dependency graph for parallel execution
    const steps = capsule.stepPlan;
    const idToStep = new Map<string, ExecutionStepT>(steps.map(s => [s.id, s]));
    const dependsMap = new Map<string, Set<string>>(); // id -> deps
    const reverseDeps = new Map<string, Set<string>>(); // id -> children

    for (const s of steps) {
      const deps = s.kind === "tool" ? (s.dependsOn ?? []) : (s.dependsOn ?? []);
      dependsMap.set(s.id, new Set(deps));
      for (const d of deps) {
        if (!reverseDeps.has(d)) reverseDeps.set(d, new Set());
        reverseDeps.get(d)!.add(s.id);
      }
      if (!reverseDeps.has(s.id)) reverseDeps.set(s.id, new Set());
    }

    const ready: string[] = steps.filter(s => (dependsMap.get(s.id)?.size ?? 0) === 0).map(s => s.id);
    const inFlight = new Set<string>();
    const done = new Set<string>();
    const maxParallel = Math.max(1, capsule.envSpec.maxParallel ?? capsule.envSpec.cpuLimit ?? 1);

    async function launch(id: string) {
      const step = idToStep.get(id)!;
      inFlight.add(id);
      try {
        if (step.kind === "tool") {
          await executeToolStep(step, capsule, outputs, logs);
        } else {
          logs.push(`step:start id=${step.id} synthesize`);
          synthesiseDraft(step as any, outputs, logs);
        }
      } finally {
        inFlight.delete(id);
        done.add(id);
        // Unblock dependents
        for (const child of reverseDeps.get(id) ?? []) {
          const deps = dependsMap.get(child)!;
          deps.delete(id);
          if (deps.size === 0) ready.push(child);
        }
      }
    }

    // Simple cooperative scheduler
    while (done.size < steps.length) {
      while (inFlight.size < maxParallel && ready.length > 0) {
        const next = ready.shift()!;
        void launch(next);
      }
      if (done.size < steps.length) {
        // Wait briefly for progress
        await new Promise(r => setTimeout(r, 5));
      }
    }

    const lastStep = capsule.stepPlan[capsule.stepPlan.length - 1];
    const finalKey = lastStep.kind === "tool"
      ? (lastStep.saveAs ?? lastStep.id)
      : (lastStep.saveAs ?? lastStep.id);
    const finalOutput = outputs.get("final") ?? outputs.get(finalKey);
    const citations = Array.from(new Set(
      (finalOutput?.citations as string[] | undefined) ??
      ((typeof finalOutput?.content === "string" && /ev:\/\//.test(finalOutput.content))
        ? [...finalOutput.content.matchAll(/ev:\/\/[^\]\s]+/g)].map(m => m[0])
        : [])
    ));

    const sandboxResult: SandboxResult = {
      output: finalOutput,
      citations,
      artifacts: [],
      logs
    };

    logs.push("sandbox:end");

    return {
      id: "run_" + Date.now(),
      capsuleId: capsule.id,
      output: sandboxResult.output,
      citations: sandboxResult.citations,
      artifacts: sandboxResult.artifacts,
      logs: sandboxResult.logs,
      createdAt: new Date().toISOString()
    };
  }
};
