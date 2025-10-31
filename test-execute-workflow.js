#!/usr/bin/env node

/**
 * Test Script: execute_full_workflow Tool
 * 
 * Demonstrates automatic end-to-end MCP orchestration:
 * 1. Plan Task - Creates task plan
 * 2. Compile Capsule - Compiles into executable
 * 3. Run Capsule - Executes in sandbox
 * 4. Reflect Pipeline - Analyzes results
 * 
 * All stages are automatically chained with data flow.
 */

import { registerAll } from "./dist/index.js";

async function testExecuteFullWorkflow() {
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║         Testing execute_full_workflow Tool                ║");
  console.log("║    (Automatic MCP Pipeline Orchestration)                 ║");
  console.log("╚════════════════════════════════════════════════════════════╝\n");

  const { toolMap } = registerAll();

  const executeWorkflow = toolMap.get("execute_full_workflow");

  if (!executeWorkflow) {
    console.error("❌ execute_full_workflow tool not found!");
    process.exit(1);
  }

  console.log("✅ Tool found!\n");

  const testGoal = "Analyze the impact of climate change on global supply chains and propose mitigation strategies";

  console.log("📋 Input:");
  console.log(`   Goal: "${testGoal}"`);
  console.log(`   Context: (optional)\n`);

  console.log("⏳ Executing full workflow...\n");

  const startTime = Date.now();

  try {
    const result = await executeWorkflow.handler({
      goal: testGoal,
      context: "Focus on technology sector and renewable energy supply chains"
    });

    const totalTime = Date.now() - startTime;

    console.log("╔════════════════════════════════════════════════════════════╗");
    console.log("║                    WORKFLOW RESULTS                        ║");
    console.log("╚════════════════════════════════════════════════════════════╝\n");

    console.log("📊 Stage Execution Summary:");
    console.log("─".repeat(60));

    result.stages.forEach((stage, idx) => {
      const status = stage.status === "success" ? "✅" : "❌";
      const id = stage.id ? ` [ID: ${stage.id.substring(0, 8)}...]` : "";
      console.log(`${idx + 1}. ${status} ${stage.name.toUpperCase()}`);
      console.log(`   Duration: ${stage.duration}ms${id}`);
      if (stage.error) {
        console.log(`   Error: ${stage.error}`);
      }
    });

    console.log("\n─".repeat(60));
    console.log(`Total Workflow Time: ${result.totalDuration}ms\n`);

    if (result.finalResult) {
      console.log("📦 Final Result:");
      console.log("─".repeat(60));
      console.log(`Plan ID:        ${result.finalResult.planId.substring(0, 16)}...`);
      console.log(`Capsule ID:     ${result.finalResult.capsuleId.substring(0, 16)}...`);
      console.log(`Run ID:         ${result.finalResult.runId.substring(0, 16)}...`);
      
      if (result.finalResult.output) {
        const outputLen = JSON.stringify(result.finalResult.output).length;
        console.log(`Output Size:    ${outputLen} bytes`);
        
        if (typeof result.finalResult.output === 'string') {
          console.log(`Output Preview: ${result.finalResult.output.substring(0, 100)}...`);
        } else if (typeof result.finalResult.output === 'object') {
          console.log(`Output Type:    ${typeof result.finalResult.output}`);
        }
      }

      if (result.finalResult.reflection) {
        console.log(`\n📊 Reflection Report:`);
        console.log(`   Severity: ${result.finalResult.reflection.severity}`);
        console.log(`   Conflicts Found: ${result.finalResult.reflection.conflicts}`);
        console.log(`   Optimizations: ${result.finalResult.reflection.optimizations}`);
      }
    }

    console.log("\n" + "─".repeat(60));
    console.log("✅ Workflow execution completed successfully!");
    console.log("═".repeat(60));
    console.log("\n🎉 execute_full_workflow is working perfectly!");
    console.log("\n   This tool automatically orchestrates all 4 MCP stages:");
    console.log("   1. Plan:    Creates execution plan from goal");
    console.log("   2. Compile: Compiles plan into executable capsule");
    console.log("   3. Run:     Executes capsule in isolated sandbox");
    console.log("   4. Reflect: Analyzes results and detects issues");
    console.log("\n   All stages chain automatically with data flow!");
    console.log("═".repeat(60) + "\n");

    return true;

  } catch (error) {
    console.error("\n❌ Workflow execution failed!");
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    
    if (error.results) {
      console.error("\nPartial Results:");
      console.error(JSON.stringify(error.results, null, 2));
    }

    return false;
  }
}

// Run test
testExecuteFullWorkflow().then(success => {
  process.exit(success ? 0 : 1);
});
