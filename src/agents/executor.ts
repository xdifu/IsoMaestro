import { ExecutionCapsuleT } from "../schemas/executionCapsule.js";
import { RunResultT } from "../schemas/runResult.js";
import { v4 as uuid } from "uuid";

export async function executeCapsuleInSandbox(capsule: ExecutionCapsuleT): Promise<RunResultT> {
  // 这里实际交给 sandbox/runner.ts；此处保留便于替换
  const id = "run_" + uuid();
  return {
    id,
    capsuleId: capsule.id,
    output: { message: `Executed capsule ${capsule.id}` },
    citations: capsule.evidenceRefs,
    artifacts: [],
    logs: [],
    createdAt: new Date().toISOString()
  };
}
