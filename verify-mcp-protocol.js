#!/usr/bin/env node

/**
 * MCP Protocol Verification
 * Sends tools/list request to MCP server and validates tool availability
 */

import { spawn } from "child_process";

const TIMEOUT = 5000;

async function verifyMCPTools() {
  console.log("========================================");
  console.log("MCP Protocol Tool Verification");
  console.log("========================================\n");

  let server = null;

  try {
    // Start MCP server
    console.log("🚀 Starting MCP Server...");
    server = spawn("node", ["dist/server.js"], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"]
    });

    if (!server.stdout || !server.stderr || !server.stdin) {
      throw new Error("Failed to create server streams");
    }

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send tools/list request via JSON-RPC
    console.log("📤 Sending tools/list request via JSON-RPC 2.0...\n");

    const request = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {}
    };

    server.stdin.write(JSON.stringify(request) + "\n");

    // Collect response
    let responseData = "";
    const responsePromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Response timeout")), TIMEOUT);

      server.stdout.on("data", (data) => {
        responseData += data.toString();
        if (responseData.includes('"jsonrpc":"2.0"')) {
          clearTimeout(timeout);
          resolve(responseData);
        }
      });

      server.stderr.on("data", (data) => {
        console.error("[SERVER LOG]", data.toString());
      });
    });

    const response = await responsePromise;
    const lines = response.split("\n").filter(line => line.trim());

    // Parse response
    let toolsList = null;
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.result && parsed.result.tools) {
          toolsList = parsed.result.tools;
          break;
        }
      } catch (e) {
        // Skip non-JSON lines (e.g., startup logs)
      }
    }

    if (!toolsList) {
      throw new Error("No tools list in response");
    }

    // Verify tools
    console.log("✅ Response received!\n");
    console.log("Available Tools via MCP Protocol:");
    console.log("─".repeat(50));

    const expectedTools = [
      "plan_task",
      "retrieve_evidence",
      "compile_capsule",
      "run_capsule",
      "reflect_pipeline",
      "render_with_pointers"
    ];

    const toolNames = new Set();
    toolsList.forEach((tool, idx) => {
      console.log(`${idx + 1}. ✅ ${tool.name}`);
      console.log(`   Description: ${tool.description}`);
      console.log(`   Input Schema: ${tool.inputSchema ? "provided" : "missing"}`);
      toolNames.add(tool.name);
    });

    console.log("\n" + "─".repeat(50));
    console.log(`Total Tools: ${toolsList.length}`);

    // Check for missing tools
    const missingTools = expectedTools.filter(name => !toolNames.has(name));
    if (missingTools.length === 0) {
      console.log("✅ All expected tools are available!");
      console.log("✅ NO TOOLS ARE DISABLED!");
      console.log("\n🎉 MCP Protocol Verification: PASSED");
      return 0;
    } else {
      console.log("❌ Missing tools:");
      missingTools.forEach(name => console.log(`   - ${name}`));
      console.log("\n❌ MCP Protocol Verification: FAILED");
      return 1;
    }

  } catch (error) {
    console.error("\n❌ Verification failed:");
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  } finally {
    if (server) {
      console.log("\n🛑 Stopping MCP Server...");
      server.kill();
    }
    console.log("========================================");
  }
}

verifyMCPTools().then(code => process.exit(code));
