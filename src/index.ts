import { planTask } from "./tools/planTask.js";
import { compileCapsule } from "./tools/compileCapsule.js";
import { runCapsule } from "./tools/runCapsule.js";
import { reflectPipeline } from "./tools/reflectPipeline.js";
import { retrieveEvidence } from "./tools/retrieveEvidence.js";
import { renderWithPointers } from "./tools/renderWithPointers.js";
import { router as evidenceRouter } from "./resources/evidence.js";
import { router as artifactRouter } from "./resources/artifact.js";
import { router as logRouter } from "./resources/log.js";
import { prompts } from "./prompts/index.js";

export function registerAll() {
  const tools: Record<string, (input: any) => Promise<any>> = {
    plan_task: planTask,
    compile_capsule: compileCapsule,
    run_capsule: runCapsule,
    reflect_pipeline: reflectPipeline,
    retrieve_evidence: retrieveEvidence,
    render_with_pointers: renderWithPointers
  };

  const resources: Record<string, (path: string) => Promise<any>> = {
    "evidence://": evidenceRouter(),
    "artifact://": artifactRouter(),
    "log://": logRouter()
  };

  return { tools, resources, prompts };
}
