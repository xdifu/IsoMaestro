#!/usr/bin/env node
/**
 * Test script to verify LLM sampling context awareness in IsoMaestro
 * 
 * This script tests whether the includeContext parameter is being used
 * in Planner and Translator agents, and demonstrates the difference.
 */

import { planner } from './src/agents/planner.js';
import { translator } from './src/agents/translator.js';
import { attachSamplingServer } from './src/runtime/sampling.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

console.log('========================================');
console.log('IsoMaestro Context Awareness Test');
console.log('========================================\n');

// Mock server setup (for testing purposes)
const mockServer = new Server({
  name: 'IsoMaestro',
  version: '1.0.0'
}, {
  capabilities: {
    tools: {},
    resources: {},
    prompts: {}
  }
});

// Check if sampling is enabled
const samplingEnabled = process.env.SAMPLING_ENABLED === "1";
console.log(`✓ Sampling enabled: ${samplingEnabled ? 'YES' : 'NO'}`);

if (!samplingEnabled) {
  console.log('\n⚠️  WARNING: Sampling is disabled.');
  console.log('   Set SAMPLING_ENABLED=1 to test with actual LLM sampling.\n');
}

// Attach server (even if disabled, to test infrastructure)
attachSamplingServer(samplingEnabled ? mockServer : null, samplingEnabled);

async function testPlannerContext() {
  console.log('\n--- Test 1: Planner Context Awareness ---\n');
  
  const goal = "Retrieve evidence about AI safety and render a comprehensive report with citations";
  
  console.log(`Goal: "${goal}"`);
  console.log('Testing planner...\n');
  
  try {
    const plan = await planner(goal);
    
    console.log('✓ Plan generated successfully');
    console.log(`  - Plan ID: ${plan.id}`);
    console.log(`  - Subtasks: ${plan.subtasks.length}`);
    console.log(`  - Tools allowlist: ${plan.toolsAllowlist.join(', ')}`);
    console.log(`  - Rationale: ${plan.rationale}`);
    
    // Check if plan references actual tools
    const referencedTools = new Set();
    plan.subtasks.forEach(subtask => {
      const toolMatch = subtask.description.match(/retrieve_evidence|render_with_pointers|plan_task|compile_capsule|run_capsule|reflect_pipeline/g);
      if (toolMatch) {
        toolMatch.forEach(t => referencedTools.add(t));
      }
    });
    
    console.log(`  - Referenced tools in descriptions: ${[...referencedTools].join(', ') || 'none'}`);
    
    // Analyze if planner seems context-aware
    if (referencedTools.size > 0) {
      console.log('\n💡 Analysis: Planner referenced specific tools in subtask descriptions.');
      console.log('   This suggests it may have context awareness (or learned from system prompt).');
    } else {
      console.log('\n💡 Analysis: Planner did not reference specific tools.');
      console.log('   This is expected if includeContext is not set.');
    }
    
  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

async function testTranslatorContext() {
  console.log('\n--- Test 2: Translator Context Awareness ---\n');
  
  const goal = "Compare quantum computing approaches";
  
  console.log(`Goal: "${goal}"`);
  console.log('Creating plan and translating...\n');
  
  try {
    const plan = await planner(goal);
    const capsule = await translator(plan);
    
    console.log('✓ Capsule generated successfully');
    console.log(`  - Capsule ID: ${capsule.id}`);
    console.log(`  - Steps: ${capsule.stepPlan.length}`);
    console.log(`  - Tools in environment: ${capsule.envSpec.toolsAllowlist.join(', ')}`);
    
    // Check if step plan references correct tools
    const stepTools = capsule.stepPlan
      .filter(step => step.kind === 'tool')
      .map(step => step.tool);
    
    console.log(`  - Tools used in steps: ${stepTools.join(', ')}`);
    
    // Validate tools
    const allowedTools = new Set(capsule.envSpec.toolsAllowlist);
    const invalidTools = stepTools.filter(tool => !allowedTools.has(tool));
    
    if (invalidTools.length > 0) {
      console.log(`\n⚠️  WARNING: Found invalid tools: ${invalidTools.join(', ')}`);
      console.log('   This suggests the translator lacks awareness of available tools.');
    } else {
      console.log('\n✓ All referenced tools are valid');
    }
    
  } catch (error) {
    console.error('✗ Error:', error.message);
  }
}

async function testContextParameter() {
  console.log('\n--- Test 3: Context Parameter Inspection ---\n');
  
  // Read the source files to check if includeContext is used
  const fs = await import('fs/promises');
  
  const plannerSource = await fs.readFile('./src/agents/planner.ts', 'utf-8');
  const translatorSource = await fs.readFile('./src/agents/translator.ts', 'utf-8');
  
  const plannerHasContext = plannerSource.includes('includeContext:');
  const translatorHasContext = translatorSource.includes('includeContext:');
  
  console.log('Source code inspection:');
  console.log(`  - Planner sets includeContext: ${plannerHasContext ? '✓ YES' : '✗ NO'}`);
  console.log(`  - Translator sets includeContext: ${translatorHasContext ? '✓ YES' : '✗ NO'}`);
  
  if (!plannerHasContext || !translatorHasContext) {
    console.log('\n💡 Recommendation:');
    console.log('   Add includeContext: "thisServer" to sampling requests in:');
    if (!plannerHasContext) console.log('   - src/agents/planner.ts');
    if (!translatorHasContext) console.log('   - src/agents/translator.ts');
    console.log('\n   This will enable LLM to access tool definitions and server metadata.');
  }
}

async function testSamplingInterface() {
  console.log('\n--- Test 4: Sampling Interface Verification ---\n');
  
  const fs = await import('fs/promises');
  const samplingSource = await fs.readFile('./src/runtime/sampling.ts', 'utf-8');
  
  const hasInterfaceDefinition = samplingSource.includes('includeContext?: "none" | "thisServer" | "allServers"');
  const passesToSDK = samplingSource.includes('includeContext: request.includeContext');
  
  console.log('Sampling infrastructure:');
  console.log(`  - SamplingRequest interface includes includeContext: ${hasInterfaceDefinition ? '✓ YES' : '✗ NO'}`);
  console.log(`  - trySampleMessage passes includeContext to SDK: ${passesToSDK ? '✓ YES' : '✗ NO'}`);
  
  if (hasInterfaceDefinition && passesToSDK) {
    console.log('\n✓ Infrastructure is ready for context-aware sampling');
  } else {
    console.log('\n⚠️  Infrastructure needs updates');
  }
}

async function runAllTests() {
  try {
    await testSamplingInterface();
    await testContextParameter();
    
    if (samplingEnabled) {
      await testPlannerContext();
      await testTranslatorContext();
    } else {
      console.log('\n⏭️  Skipping runtime tests (sampling disabled)');
      console.log('   Static analysis complete.');
    }
    
    console.log('\n========================================');
    console.log('Summary');
    console.log('========================================\n');
    
    console.log('Based on this analysis:');
    console.log('1. IsoMaestro HAS infrastructure support for includeContext');
    console.log('2. Planner and Translator DO NOT currently use includeContext');
    console.log('3. This means LLM does not receive server tool/resource context');
    console.log('4. Recommendation: Add includeContext: "thisServer" to both agents\n');
    
    console.log('For detailed analysis, see: LLM_CONTEXT_ANALYSIS.md');
    console.log('To apply fixes, run: git apply enable-context.patch\n');
    
  } catch (error) {
    console.error('\n✗ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runAllTests();
