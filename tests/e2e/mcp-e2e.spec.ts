import test from "node:test";
import { strict as assert } from "node:assert";
import { planTask } from "../../src/tools/planTask.js";
import { compileCapsule } from "../../src/tools/compileCapsule.js";
import { runCapsule } from "../../src/tools/runCapsule.js";
import { reflectPipeline } from "../../src/tools/reflectPipeline.js";

test("mcp toolchain end-to-end", async () => {
  const plan = await planTask({ goal: "Summarize pointer-first RAG best practices" });
  assert.ok(plan.subtasks.length >= 2, "planner created subtasks");

  const capsule = await compileCapsule({ planId: plan.id });
  assert.ok(capsule.stepPlan.length >= 3, "translator produced step plan");

  const run = await runCapsule({ capsule });
  assert.equal(run.output?.ok, true, "executor validated draft");
  assert.ok((run.citations ?? []).length >= 1, "run produced citations");
  assert.ok((run.artifacts ?? []).some(a => a.startsWith("artifact://")), "run artifacts persisted");

  const reflection = await reflectPipeline({ runIds: [run.id] });
  assert.ok(reflection.severity === "low" || reflection.severity === "medium", "reflection completed");
});
