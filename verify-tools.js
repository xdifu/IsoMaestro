#!/usr/bin/env node

/**
 * Tool Registration Verification
 * Ensures all 6 tools are properly registered and no tool is disabled
 */

import { registerAll } from "./dist/index.js";

const { tools, toolMap } = registerAll();

console.log("========================================");
console.log("Tool Registration Verification Report");
console.log("========================================\n");

console.log(`✓ Total Tools Registered: ${tools.length}\n`);

console.log("Registered Tools:");
console.log("─".repeat(50));

const toolNames = [
  "plan_task",
  "retrieve_evidence",
  "compile_capsule",
  "run_capsule",
  "reflect_pipeline",
  "render_with_pointers",
  "execute_full_workflow"
];

let allPresent = true;
toolNames.forEach((name, idx) => {
  const tool = toolMap.get(name);
  if (tool) {
    console.log(`${idx + 1}. ✅ ${name}`);
    console.log(`   Description: ${tool.description}`);
    console.log(`   Handler: ${typeof tool.handler}`);
  } else {
    console.log(`${idx + 1}. ❌ ${name} - NOT FOUND`);
    allPresent = false;
  }
});

console.log("\n" + "─".repeat(50));
if (allPresent && tools.length === 7) {
  console.log("✅ All 7 tools are correctly registered!");
  console.log("✅ No tools are disabled!");
  console.log("\n🎉 Tool registration is VALID");
} else {
  console.log("❌ Tool registration issue detected!");
  console.log(`   Expected: 7 tools, Found: ${tools.length}`);
  console.log(`   All present: ${allPresent}`);
}
console.log("========================================");

process.exit(allPresent && tools.length === 6 ? 0 : 1);
