import { ExecutionCapsuleT, ExecutionStepT } from "../schemas/executionCapsule.js";
import { SandboxResult } from "./types.js";
import { retrieveEvidence } from "../tools/retrieveEvidence.js";
import { renderWithPointers } from "../tools/renderWithPointers.js";

type StepOutputs = Map<string, any>;

const TOOL_EXECUTORS: Record<string, (input: any) => Promise<any>> = {
  retrieve_evidence: retrieveEvidence,
  render_with_pointers: renderWithPointers
};

const MAX_RETRIES = 3;

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

async function runToolWithRetry(step: Extract<ExecutionStepT, { kind: "tool" }>, capsule: ExecutionCapsuleT, outputs: StepOutputs, logs: string[]): Promise<void> {
  if (!capsule.envSpec.toolsAllowlist.includes(step.tool)) {
    throw new Error(`TOOL_NOT_ALLOWED:${step.tool}`);
  }
  const executor = TOOL_EXECUTORS[step.tool];
  if (!executor) {
    throw new Error(`TOOL_NOT_IMPLEMENTED:${step.tool}`);
  }

  let attempt = 0;
  let error: unknown = null;
  while (attempt < MAX_RETRIES) {
    attempt += 1;
    logs.push(`step:attempt id=${step.id} tool=${step.tool} n=${attempt}`);
    try {
      const resolvedInput = resolveTemplatedInput(step.input, outputs);
      const key = step.saveAs ?? step.id;
      const result = await executor(resolvedInput);
      if (outputs.has(key)) {
        logs.push(`step:output_overwrite id=${step.id} key=${key}`);
      }
      outputs.set(key, result);
      logs.push(`step:attempt-success id=${step.id} tool=${step.tool} n=${attempt}`);
      return;
    } catch (err) {
      error = err;
      logs.push(`step:attempt-error id=${step.id} tool=${step.tool} n=${attempt} error=${(err as Error).message}`);
      if (attempt >= MAX_RETRIES) {
        throw err instanceof Error ? err : new Error(String(err));
      }
      const backoff = Math.pow(2, attempt - 1) * 100;
      await new Promise(r => setTimeout(r, backoff));
    }
  }

  throw error instanceof Error ? error : new Error("STEP_FAILED");
}

function synthesiseDraft(step: Extract<ExecutionStepT, { kind: "synthesize" }>, outputs: StepOutputs, logs: string[]): void {
  const keys = step.source.split(",").map(s => s.trim()).filter(Boolean);
  const collected: any[] = [];
  for (const key of keys) {
    const src = outputs.get(key);
    if (!src) continue;
    const arr = src.items ?? src.cards ?? [];
    if (Array.isArray(arr)) collected.push(...arr);
  }
  if (collected.length === 0) {
    throw new Error(`SYNTHESIS_SOURCE_MISSING:${step.source}`);
  }
  if (!Array.isArray(collected) || collected.length === 0) {
    throw new Error("SYNTHESIS_NO_EVIDENCE");
  }
  const selected = collected.slice(0, step.maxItems);
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
  const key = step.saveAs ?? step.id;
  if (outputs.has(key)) {
    logs.push(`step:output_overwrite id=${step.id} key=${key}`);
  }
  outputs.set(key, result);
}

export const sandboxRunner = {
  async run(capsule: ExecutionCapsuleT): Promise<{ id: string; capsuleId: string; output: any; citations: string[]; artifacts: string[]; logs: string[]; createdAt: string; }> {
    const logs: string[] = [];
    logs.push(`sandbox:start capsule=${capsule.id}`);
    logs.push(`sandbox:tools ${capsule.envSpec.toolsAllowlist.join(",")}`);
    const outputs: StepOutputs = new Map();

    const steps = capsule.stepPlan;
    const idToStep = new Map<string, ExecutionStepT>(steps.map(s => [s.id, s]));
    const dependsMap = new Map<string, Set<string>>();
    const reverseDeps = new Map<string, Set<string>>();

    for (const s of steps) {
      const deps = s.dependsOn ?? [];
      dependsMap.set(s.id, new Set(deps));
      for (const d of deps) {
        if (!reverseDeps.has(d)) reverseDeps.set(d, new Set());
        reverseDeps.get(d)!.add(s.id);
      }
      if (!reverseDeps.has(s.id)) reverseDeps.set(s.id, new Set());
    }

    const ready: string[] = steps.filter(s => (dependsMap.get(s.id)?.size ?? 0) === 0).map(s => s.id);
    const active = new Set<Promise<void>>();
    const inFlight = new Set<string>();
    const done = new Set<string>();

    const cpuLimit = Math.max(1, capsule.envSpec.cpuLimit ?? 1);
    const declaredMaxParallel = Math.max(1, capsule.envSpec.maxParallel ?? cpuLimit);
    let dynamicParallel = Math.max(1, Math.min(cpuLimit, declaredMaxParallel));
    let totalDuration = 0;
    let completedCount = 0;
    let encounteredError: Error | null = null;

    function updateParallel() {
      const avg = completedCount > 0 ? totalDuration / completedCount : 0;
      const queueDepth = ready.length;
      let target = dynamicParallel;
      if (queueDepth > dynamicParallel && avg < 1000) {
        target = Math.min(declaredMaxParallel, dynamicParallel + 1);
      } else if (queueDepth <= Math.max(1, dynamicParallel / 2) && avg > 1500) {
        target = Math.max(cpuLimit, dynamicParallel - 1);
      }
      if (target !== dynamicParallel) {
        logs.push(`sandbox:parallel_adjust from=${dynamicParallel} to=${target} avgMs=${Math.round(avg)}`);
        dynamicParallel = target;
      }
    }

    async function launch(id: string): Promise<void> {
      const step = idToStep.get(id);
      if (!step) return;
      inFlight.add(id);
      const startedAt = Date.now();
      logs.push(`step:start id=${step.id} kind=${step.kind}${step.kind === "tool" ? ` tool=${(step as any).tool}` : ""}`);
      let success = false;
      try {
        if (step.kind === "tool") {
          await runToolWithRetry(step, capsule, outputs, logs);
        } else {
          synthesiseDraft(step as Extract<ExecutionStepT, { kind: "synthesize" }>, outputs, logs);
        }
        success = true;
        const duration = Date.now() - startedAt;
        totalDuration += duration;
        completedCount += 1;
        logs.push(`step:complete id=${step.id} durationMs=${duration} status=success`);
      } catch (error) {
        const duration = Date.now() - startedAt;
        totalDuration += duration;
        completedCount += 1;
        logs.push(`step:error id=${step.id} durationMs=${duration} status=error error=${(error as Error).message}`);
        encounteredError = error instanceof Error ? error : new Error(String(error));
        throw encounteredError;
      } finally {
        inFlight.delete(id);
        if (success) {
          done.add(id);
          for (const child of reverseDeps.get(id) ?? []) {
            const deps = dependsMap.get(child)!;
            deps.delete(id);
            if (deps.size === 0) ready.push(child);
          }
        }
        updateParallel();
      }
    }

    while (done.size < steps.length && !encounteredError) {
      while (!encounteredError && active.size < dynamicParallel && ready.length > 0) {
        const next = ready.shift();
        if (!next) break;
        const task = launch(next);
        active.add(task);
        task
          .catch(() => { /* handled via encounteredError */ })
          .finally(() => active.delete(task));
      }
      if (encounteredError) break;
      if (done.size >= steps.length) break;
      if (active.size === 0 && ready.length === 0) break;
      await new Promise(r => setTimeout(r, 5));
    }

    await Promise.allSettled(Array.from(active));

    if (encounteredError) {
      logs.push("sandbox:end error");
      throw encounteredError;
    }

    const lastStep = capsule.stepPlan[capsule.stepPlan.length - 1];
    const finalKey = lastStep.saveAs ?? lastStep.id;
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

    logs.push("sandbox:end ok");

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
