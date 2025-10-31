import { Tool } from "@modelcontextprotocol/sdk/types.js";
import planTaskInputSchema from "../../schemas/planTaskInput.json" with { type: "json" };
import compileCapsuleInputSchema from "../../schemas/compileCapsuleInput.json" with { type: "json" };
import runCapsuleInputSchema from "../../schemas/runCapsuleInput.json" with { type: "json" };
import reflectInputSchema from "../../schemas/reflectInput.json" with { type: "json" };
import retrieveInputSchema from "../../schemas/retrieveInput.json" with { type: "json" };
import renderInputSchema from "../../schemas/renderInput.json" with { type: "json" };

export const toolDefinitions: Tool[] = [
  {
    name: "plan_task",
    description: "Decompose a user goal into executable subtasks using multi-agent planning",
    inputSchema: planTaskInputSchema as Tool["inputSchema"]
  },
  {
    name: "compile_capsule",
    description: "Compile a task contract into an executable capsule with dependencies resolved",
    inputSchema: compileCapsuleInputSchema as Tool["inputSchema"]
  },
  {
    name: "run_capsule",
    description: "Execute a compiled execution capsule in an isolated sandbox environment",
    inputSchema: runCapsuleInputSchema as Tool["inputSchema"]
  },
  {
    name: "reflect_pipeline",
    description: "Analyze and reflect on execution results using the reflector agent",
    inputSchema: reflectInputSchema as Tool["inputSchema"]
  },
  {
    name: "retrieve_evidence",
    description: "Retrieve relevant evidence cards from the RAG store based on query",
    inputSchema: retrieveInputSchema as Tool["inputSchema"]
  },
  {
    name: "render_with_pointers",
    description: "Render content with embedded pointers to evidence sources and citations",
    inputSchema: renderInputSchema as Tool["inputSchema"]
  }
];
