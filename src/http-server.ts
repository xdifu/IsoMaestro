import { createServer, IncomingMessage, ServerResponse } from "http";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { registerAll } from "./index.js";
import { toolDefinitions } from "./schemas/toolDefinitions.js";
import { attachSamplingServer } from "./runtime/sampling.js";
import { env } from "./config/env.js";

const PORT = process.env.MCP_PORT || 3001;

// Store active transports by session ID
const activeTransports = new Map<string, SSEServerTransport>();

function createMcpServer(): Server {
  const state = registerAll();

  const samplingEnabled = env.samplingEnabled === true;

  const server = new Server({
    name: "IsoMaestro",
    version: "0.1.0"
  }, {
    capabilities: {
      tools: {
        listChanged: false
      },
      resources: {
        listChanged: false,
        subscribe: false
      },
      prompts: {
        listChanged: false
      },
      ...(samplingEnabled ? { sampling: {} } : {})
    }
  });

  attachSamplingServer(samplingEnabled ? server : null, samplingEnabled);

  // Implement tools/list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: toolDefinitions
    };
  });

  // Implement tools/call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const handler = state.toolMap.get(name)?.handler;
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }

    try {
      const result = await handler(args ?? {});

      return {
        content: [
          {
            type: "text",
            text: typeof result === "string" ? result : JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Error executing tool ${name}: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  });

  // Implement resources/list handler
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    return {
      resources: state.resources.map(({ uri, description }) => ({
        uri,
        name: uri.replace("://", ": ").toUpperCase(),
        description,
        mimeType: "application/json"
      }))
    };
  });

  // Implement resources/read handler
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri, path: resourcePath } = request.params;

    const handler = state.resourceMap.get(uri as string)?.reader;
    if (!handler) {
      throw new Error(`Unknown resource: ${uri}`);
    }

    try {
      const data = await handler(typeof resourcePath === "string" ? resourcePath : "");

      const content =
        typeof data === "string" ? data : JSON.stringify(data, null, 2);

      return {
        contents: [
          {
            uri: uri + (resourcePath ? `#${resourcePath}` : ""),
            mimeType: "application/json",
            text: content
          }
        ]
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to read resource ${uri}: ${errorMessage}`);
    }
  });

  // Implement prompts/list handler
  server.setRequestHandler(ListPromptsRequestSchema, async () => {
    return {
      prompts: state.promptList.map(({ name, description }) => ({
        name,
        description,
        arguments: getPromptArguments(name)
      }))
    };
  });

  // Implement prompts/get handler
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: promptArgs } = request.params;

    const prompt = state.promptMap.get(name);
    if (!prompt) {
      throw new Error(`Unknown prompt: ${name}`);
    }

    let processedPrompt = prompt.messages[0]?.content?.[0]?.text ?? "";
    if (promptArgs) {
      for (const [key, value] of Object.entries(promptArgs)) {
        processedPrompt = processedPrompt.replace(
          new RegExp(`\\{${key}\\}`, "g"),
          String(value)
        );
      }
    }

    return {
      description: getPromptDescription(name),
      messages: [
        {
          role: "system",
          content: [{
            type: "text",
            text: processedPrompt
          }]
        }
      ]
    };
  });

  return server;
}

// Helper functions
function getResourceDescription(uri: string): string {
  const descriptions: Record<string, string> = {
    "evidence://": "Evidence cards and retrieved passages from the RAG store",
    "artifact://": "Artifacts and outputs generated by execution runs",
    "log://": "Structured execution logs and metrics"
  };
  return descriptions[uri] ?? `Resource: ${uri}`;
}

function getPromptDescription(name: string): string {
  const descriptions: Record<string, string> = {
    planner_system: "System prompt for the multi-agent planner",
    translator_system: "System prompt for the task translator agent",
    reflector_criteria: "Reflection criteria and guidelines for the reflector agent"
  };
  return descriptions[name] ?? `Prompt: ${name}`;
}

function getPromptArguments(name: string): Array<{
  name: string;
  description: string;
  required?: boolean;
}> {
  const arguments_map: Record<
    string,
    Array<{ name: string; description: string; required?: boolean }>
  > = {
    planner_system: [
      {
        name: "goal",
        description: "The user goal to plan",
        required: false
      },
      {
        name: "context",
        description: "Additional planning context",
        required: false
      }
    ],
    translator_system: [],
    reflector_criteria: [
      {
        name: "result",
        description: "Execution result to reflect on",
        required: false
      }
    ]
  };
  return arguments_map[name] ?? [];
}

// Create HTTP server
const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url || "", `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/sse") {
    // Handle SSE connection
    try {
      const transport = new SSEServerTransport("/message", res);
      const server = createMcpServer();

      activeTransports.set(transport.sessionId, transport);

      // Send initial SSE message with sessionId
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      });
      res.write(`data: ${JSON.stringify({ type: "session", sessionId: transport.sessionId })}\n\n`);

      await server.connect(transport);

      console.log(`[HTTP MCP] SSE connection established, session: ${transport.sessionId}`);
    } catch (error) {
      console.error("[HTTP MCP] SSE connection failed:", error);
      res.writeHead(500);
      res.end("Internal Server Error");
    }
  } else if (req.method === "POST" && url.pathname === "/message") {
    // Handle POST messages
    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) {
      res.writeHead(400);
      res.end("Missing sessionId");
      return;
    }

    const transport = activeTransports.get(sessionId);
    if (!transport) {
      res.writeHead(404);
      res.end("Session not found");
      return;
    }

    try {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
      }

      const parsedBody = JSON.parse(body);
      await transport.handlePostMessage(req, res, parsedBody);
    } catch (error) {
      console.error("[HTTP MCP] POST message failed:", error);
      res.writeHead(500);
      res.end("Internal Server Error");
    }
  } else {
    res.writeHead(404);
    res.end("Not Found");
  }
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`[IsoMaestro HTTP MCP] Server listening on port ${PORT}`);
  console.log(`[IsoMaestro HTTP MCP] SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`[IsoMaestro HTTP MCP] POST endpoint: http://localhost:${PORT}/message`);
  console.log(`[IsoMaestro HTTP MCP] Sampling enabled: ${env.samplingEnabled}`);
});