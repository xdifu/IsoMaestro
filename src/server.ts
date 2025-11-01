import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAll } from "./index.js";
import { env } from "./config/env.js";
import { attachSamplingServer } from "./runtime/sampling.js";

// Initialize state with all tools, resources, and prompts
const state = registerAll();

// Protocol version aligned with official MCP spec (2025-06-18)
const PROTOCOL_VERSION = "2025-06-18";
const samplingEnabled = env.samplingEnabled === true;

// Create McpServer instance (high-level API)
const mcpServer = new McpServer(
  {
    name: "IsoMaestro",
    version: "0.1.0"
  },
  {
    capabilities: {
      ...(samplingEnabled ? { sampling: {} } : {})
    }
  }
);

// Attach sampling capability to the underlying Server instance
attachSamplingServer(samplingEnabled ? mcpServer.server : null, samplingEnabled);

// Register all tools using McpServer's high-level tool() API
for (const toolDef of state.tools) {
  const toolHandler = state.toolMap.get(toolDef.name);
  if (!toolHandler) continue;

  const { handler, outputSchema } = toolHandler;

  // Register tool with simple callback
  // Note: McpServer expects the handler to receive the full arguments object
  mcpServer.tool(
    toolDef.name,
    toolDef.description || `Execute ${toolDef.name}`,
    async (args: any) => {
      console.error(`[TOOL ${toolDef.name}] Called with args:`, JSON.stringify(args, null, 2));
      try {
        // Pass args directly to handler - don't default to empty object
        const result = await handler(args);
        console.error(`[TOOL ${toolDef.name}] Result:`, typeof result === 'string' ? result.substring(0, 200) : JSON.stringify(result).substring(0, 200));
        
        const contentText =
          typeof result === "string" ? result : JSON.stringify(result, null, 2);

        const response: any = {
          content: [{ type: "text", text: contentText }]
        };

        // Include structured output if available
        if (outputSchema && typeof result === "object" && result !== null) {
          response.structuredContent = result;
        }

        return response;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[TOOL ${toolDef.name}] Error:`, errorMessage);
        return {
          content: [{ type: "text", text: `Error: ${errorMessage}` }],
          isError: true
        };
      }
    }
  );
}

// Register all resources using McpServer's resource() API
for (const resource of state.resources) {
  const resourceHandler = state.resourceMap.get(resource.uri);
  if (!resourceHandler) continue;

  mcpServer.resource(
    resource.uri,
    resource.uri,
    {
      description: resource.description,
      mimeType: "application/json"
    },
    async () => {
      try {
        const data = await resourceHandler.reader("");
        const content = typeof data === "string" ? data : JSON.stringify(data, null, 2);
        return {
          contents: [{
            uri: resource.uri,
            mimeType: "application/json",
            text: content
          }]
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to read resource: ${errorMessage}`);
      }
    }
  );
}

// Start server
async function start() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);

  // Log startup info to stderr
  console.error(`[IsoMaestro] MCP Server started`);
  console.error(`[IsoMaestro] Protocol Version: ${PROTOCOL_VERSION}`);
  console.error(`[IsoMaestro] Available Tools: ${state.tools.length}`);
  console.error(`[IsoMaestro] Sampling Enabled: ${samplingEnabled}`);
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
