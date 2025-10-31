#!/usr/bin/env node

/**
 * Direct MCP Tool Invocation Demo
 */

import { planTask } from "./dist/tools/planTask.js";
import { compileCapsule } from "./dist/tools/compileCapsule.js";
import { runCapsule } from "./dist/tools/runCapsule.js";
import { reflectPipeline } from "./dist/tools/reflectPipeline.js";

async function main() {
  console.log("🚀 Starting Complete MCP Flow Demonstration...\n");

  try {
    // Step 1: Plan
    console.log("📋 Step 1: Planning Task");
    console.log("─".repeat(50));
    const plan = await planTask({
      goal: "Demonstrate complete MCP protocol with planning, compilation, execution and reflection",
      context: "IsoMaestro multi-agent framework demonstration"
    });
    console.log(`✅ Plan created with ID: ${plan.id}`);
    console.log(`   Subtasks: ${plan.subtasks.length}`);
    console.log(`   Goal: ${plan.userGoal}\n`);

    // Step 2: Compile
    console.log("📦 Step 2: Compiling Execution Capsule");
    console.log("─".repeat(50));
    const capsule = await compileCapsule({
      contract: plan
    });
    console.log(`✅ Capsule compiled with ID: ${capsule.id}`);
    console.log(`   Steps in Plan: ${capsule.stepPlan?.length || 0}`);
    console.log(`   Objective: ${capsule.objective}\n`);

    // Step 3: Execute
    console.log("⚙️  Step 3: Executing Capsule");
    console.log("─".repeat(50));
    const runResult = await runCapsule({
      capsule: capsule
    });
    console.log(`✅ Execution completed with Run ID: ${runResult.id}`);
    console.log(`   Capsule ID: ${runResult.capsuleId}`);
    console.log(`   Citations: ${runResult.citations?.length || 0}`);
    console.log(`   Created: ${runResult.createdAt}\n`);

    // Step 4: Reflect
    console.log("🔍 Step 4: Reflecting on Execution");
    console.log("─".repeat(50));
    const reflection = await reflectPipeline({
      runIds: [runResult.id]
    });
    console.log(`✅ Reflection completed`);
    console.log(`   Severity: ${reflection.severity}`);
    console.log(`   Conflicts: ${reflection.conflicts?.length || 0}`);
    console.log(`   Optimizations: ${reflection.optimizations?.length || 0}\n`);

    // Final Report
    console.log("═".repeat(50));
    console.log("✨ COMPLETE MCP FLOW SUMMARY");
    console.log("═".repeat(50));
    console.log(`Plan ID:       ${plan.id}`);
    console.log(`Capsule ID:    ${capsule.id}`);
    console.log(`Run ID:        ${runResult.id}`);
    console.log(`Reflection:    Severity=${reflection.severity}`);
    console.log("\n🎉 All 4 MCP pipeline stages executed successfully!");
    if (reflection.conflicts.length > 0) {
      console.log("\n📊 Conflicts Detected:");
      reflection.conflicts.forEach((c, i) => {
        console.log(`   ${i+1}. [${c.severity}] ${c.type}: ${c.description}`);
      });
    }
    if (reflection.optimizations.length > 0) {
      console.log("\n💡 Optimization Suggestions:");
      reflection.optimizations.forEach((opt, i) => {
        console.log(`   ${i+1}. ${opt}`);
      });
    }
    console.log("═".repeat(50));

  } catch (error) {
    console.error("\n❌ Error occurred:");
    console.error(error);
    process.exit(1);
  }
}

main();
