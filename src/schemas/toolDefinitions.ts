import { Tool } from "@modelcontextprotocol/sdk/types.js";

export const toolDefinitions: Tool[] = [
  {
    name: "plan_task",
    description: "Decompose a user goal into executable subtasks using multi-agent planning",
    inputSchema: {
      type: "object",
      properties: {
        goal: {
          type: "string",
          description: "The primary goal or objective to be planned and decomposed into subtasks"
        },
        context: {
          type: "string",
          description: "Optional additional context or constraints for planning"
        }
      },
      required: ["goal"]
    }
  },
  {
    name: "compile_capsule",
    description: "Compile a task contract into an executable capsule with dependencies resolved",
    inputSchema: {
      type: "object",
      properties: {
        contract: {
          type: "object",
          description: "TaskContract object containing task specifications and constraints",
          properties: {
            id: { type: "string" },
            userGoal: { type: "string" },
            rationale: { type: "string" },
            subtasks: { type: "array" }
          },
          required: ["id", "userGoal", "subtasks"]
        }
      },
      required: ["contract"]
    }
  },
  {
    name: "run_capsule",
    description: "Execute a compiled execution capsule in an isolated sandbox environment",
    inputSchema: {
      type: "object",
      properties: {
        capsule: {
          type: "object",
          description: "ExecutionCapsule containing compiled tasks and dependencies"
        },
        timeout: {
          type: "number",
          description: "Maximum execution timeout in milliseconds (default: 30000)"
        },
        maxRetries: {
          type: "number",
          description: "Maximum retry attempts for failed subtasks (default: 3)"
        }
      },
      required: ["capsule"]
    }
  },
  {
    name: "reflect_pipeline",
    description: "Analyze and reflect on execution results using the reflector agent",
    inputSchema: {
      type: "object",
      properties: {
        result: {
          type: "object",
          description: "RunResult object containing execution outcomes and metrics"
        },
        criteria: {
          type: "string",
          description: "Optional reflection criteria or focus areas for analysis"
        },
        depth: {
          type: "string",
          enum: ["shallow", "deep", "comprehensive"],
          description: "Depth of reflection analysis"
        }
      },
      required: ["result"]
    }
  },
  {
    name: "retrieve_evidence",
    description: "Retrieve relevant evidence cards from the RAG store based on query",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query to retrieve evidence"
        },
        limit: {
          type: "number",
          description: "Maximum number of evidence cards to return (default: 10, max: 50)"
        },
        filter: {
          type: "object",
          description: "Optional filter criteria (source, type, date range, etc.)",
          properties: {
            source: { type: "string" },
            type: { type: "string" },
            minDate: { type: "string", format: "date" },
            maxDate: { type: "string", format: "date" }
          }
        }
      },
      required: ["query"]
    }
  },
  {
    name: "render_with_pointers",
    description: "Render content with embedded pointers to evidence sources and citations",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "The primary content to render"
        },
        evidence: {
          type: "array",
          description: "Array of evidence cards with pointer information",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              source: { type: "string" },
              passage: { type: "string" }
            }
          }
        },
        format: {
          type: "string",
          enum: ["markdown", "html", "plaintext"],
          description: "Output format (default: markdown)"
        },
        includeFootnotes: {
          type: "boolean",
          description: "Whether to include footnote references (default: true)"
        }
      },
      required: ["content"]
    }
  }
];
