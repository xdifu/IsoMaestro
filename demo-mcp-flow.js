#!/usr/bin/env node

/**
 * Complete MCP Flow Demonstration
 * Demonstrates: planTask → compileCapsule → runCapsule → reflectPipeline
 */

import { planTask } from "./dist/tools/planTask.js";
import { compileCapsule } from "./dist/tools/compileCapsule.js";
import { runCapsule } from "./dist/tools/runCapsule.js";
import { reflectPipeline } from "./dist/tools/reflectPipeline.js";

async function demonstrateMCPFlow() {
  console.log("========================================");
  console.log("IsoMaestro MCP Flow Demonstration");
  console.log("========================================\n");

  try {
    // Step 1: Plan Task
    console.log("Step 1: Planning Task...");
    const taskGoal = "Analyze and document the complete MCP protocol implementation with evidence retrieval";
    const plan = await planTask({
      goal: taskGoal,
      context: "This is a demonstration of the IsoMaestro multi-agent planning framework"
    });
    console.log("✓ Plan generated:");
    console.log(`  ID: ${plan.id}`);
    console.log(`  Subtasks: ${plan.subtasks.length}`);
    console.log(`  Created: ${plan.createdAt}\n`);

    // Step 2: Compile Capsule
    console.log("Step 2: Compiling Execution Capsule...");
    const capsule = await compileCapsule({
      contract: plan
    });
    console.log("✓ Capsule compiled:");
    console.log(`  ID: ${capsule.id}`);
    console.log(`  Tasks: ${capsule.tasks.length}`);
    console.log(`  Tools: ${capsule.tools.length}`);
    console.log(`  Created: ${capsule.createdAt}\n`);

    // Step 3: Run Capsule
    console.log("Step 3: Executing Capsule...");
    const runResult = await runCapsule({
      capsule: capsule
    });
    console.log("✓ Capsule executed:");
    console.log(`  Run ID: ${runResult.id}`);
    console.log(`  Status: ${runResult.status}`);
    console.log(`  Duration: ${runResult.duration}ms`);
    console.log(`  Results: ${runResult.results.length}\n`);

    // Step 4: Reflect on Results
    console.log("Step 4: Reflecting on Results...");
    const reflection = await reflectPipeline({
      runIds: [runResult.id]
    });
    console.log("✓ Reflection completed:");
    console.log(`  Reflection ID: ${reflection.id}`);
    console.log(`  Summary: ${reflection.summary}`);
    console.log(`  Insights: ${reflection.insights.length}\n`);

    // Final Summary
    console.log("========================================");
    console.log("Complete MCP Flow Summary");
    console.log("========================================");
    console.log(`✓ Plan ID:       ${plan.id}`);
    console.log(`✓ Capsule ID:    ${capsule.id}`);
    console.log(`✓ Run ID:        ${runResult.id}`);
    console.log(`✓ Reflection ID: ${reflection.id}`);
    console.log("\n✓ All 4 stages completed successfully!");
    console.log("========================================\n");

  } catch (error) {
    console.error("❌ Error in MCP Flow:");
    console.error(error.message);
    process.exit(1);
  }
}

demonstrateMCPFlow();
