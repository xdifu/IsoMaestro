import { ExecutionCapsuleT } from "../schemas/executionCapsule.js";
import { SandboxResult } from "./types.js";

export const sandboxRunner = {
  async run(capsule: ExecutionCapsuleT): Promise<{ id: string; capsuleId: string; output: any; citations: string[]; artifacts: string[]; logs: string[]; createdAt: string; }> {
    // Mock：不真正起容器，只回显
    const logs = [
      `sandbox:start capsule=${capsule.id}`,
      `sandbox:allow tools=${capsule.envSpec.toolsAllowlist.join(",")}`,
      `sandbox:end`
    ];
    const out: SandboxResult = {
      output: { ok: true, message: "mock executed", objective: capsule.objective },
      citations: capsule.evidenceRefs,
      artifacts: [],
      logs
    };
    return {
      id: "run_" + Date.now(),
      capsuleId: capsule.id,
      output: out.output,
      citations: out.citations,
      artifacts: out.artifacts,
      logs: out.logs,
      createdAt: new Date().toISOString()
    };
  }
};
