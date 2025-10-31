import { translator } from "../agents/translator.js";
import { store } from "../store/kv.js";
import { TaskContract } from "../schemas/taskContract.js";
import { ExecutionCapsule } from "../schemas/executionCapsule.js";

export async function compileCapsule(input: { planId?: string; contract?: any }) {
  const contract = input?.contract ?? await store.get("plans", input?.planId!);
  const parsed = TaskContract.parse(contract);
  const capsule = await translator(parsed);
  const out = ExecutionCapsule.parse(capsule);
  await store.save("capsules", out.id, out);
  return out;
}
