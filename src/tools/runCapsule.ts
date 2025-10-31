import { store } from "../store/kv.js";
import { usedCapsules } from "../store/usedCapsules.js";
import { ExecutionCapsule } from "../schemas/executionCapsule.js";
import { RunResult } from "../schemas/runResult.js";
import { sandboxRunner } from "../sandbox/runner.js";

export async function runCapsule(input: { capsuleId?: string; capsule?: any }) {
  const capsule = ExecutionCapsule.parse(input?.capsule ?? await store.get("capsules", input?.capsuleId!));
  await usedCapsules.ensureUnusedOrThrow(capsule.id);
  const result = await sandboxRunner.run(capsule);
  await usedCapsules.markUsed(capsule.id);
  const out = RunResult.parse(result);
  await store.save("runs", out.id, out);
  return out;
}
