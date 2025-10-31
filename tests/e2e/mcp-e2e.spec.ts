import { strict as assert } from "node:assert";
import { planner } from "../../src/agents/planner.js";
import { translator } from "../../src/agents/translator.js";
import { retriever } from "../../src/rag/retriever.js";
import { sandboxRunner } from "../../src/sandbox/runner.js";

(async () => {
  const plan = await planner("Write a short pointer-based summary");
  assert.ok(plan.id && plan.subtasks.length > 0);

  const caps = await translator(plan);
  assert.equal(caps.oneShot, true);

  const cards = await retriever.search("pointer", 5);
  assert.ok(cards.length > 0);

  const run = await sandboxRunner.run(caps);
  assert.ok(run.id && run.capsuleId);

  console.log("E2E OK");
})();
