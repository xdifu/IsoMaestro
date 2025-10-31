import { Tool } from "@modelcontextprotocol/sdk/types.js";
import planTaskInputSchema from "../../schemas/planTaskInput.json" with { type: "json" };
import taskContractSchema from "../../schemas/taskContract.json" with { type: "json" };
import compileCapsuleInputSchema from "../../schemas/compileCapsuleInput.json" with { type: "json" };
import executionCapsuleSchema from "../../schemas/executionCapsule.json" with { type: "json" };
import runCapsuleInputSchema from "../../schemas/runCapsuleInput.json" with { type: "json" };
import runResultSchema from "../../schemas/runResult.json" with { type: "json" };
import reflectInputSchema from "../../schemas/reflectInput.json" with { type: "json" };
import reflectionReportSchema from "../../schemas/reflectionReport.json" with { type: "json" };
import retrieveInputSchema from "../../schemas/retrieveInput.json" with { type: "json" };
import evidenceCardListSchema from "../../schemas/evidenceCardList.json" with { type: "json" };
import renderInputSchema from "../../schemas/renderInput.json" with { type: "json" };
import renderOutputSchema from "../../schemas/renderOutput.json" with { type: "json" };

export const toolDefinitions: Tool[] = [
  {
    name: "execute_full_workflow",
    description: "Automatically execute complete MCP workflow: planning → compilation → execution → reflection (all stages automated)",
    inputSchema: planTaskInputSchema as Tool["inputSchema"]
  },
  {
    name: "plan_task",
    description: "Decompose a user goal into executable subtasks using multi-agent planning",
    inputSchema: planTaskInputSchema as Tool["inputSchema"],
    outputSchema: taskContractSchema as Tool["outputSchema"]
  },
  {
    name: "compile_capsule",
    description: "Compile a task contract into an executable capsule with dependencies resolved",
    inputSchema: compileCapsuleInputSchema as Tool["inputSchema"],
    outputSchema: executionCapsuleSchema as Tool["outputSchema"]
  },
  {
    name: "run_capsule",
    description: "Execute a compiled execution capsule in an isolated sandbox environment",
    inputSchema: runCapsuleInputSchema as Tool["inputSchema"],
    outputSchema: runResultSchema as Tool["outputSchema"]
  },
  {
    name: "reflect_pipeline",
    description: "Analyze and reflect on execution results using the reflector agent",
    inputSchema: reflectInputSchema as Tool["inputSchema"],
    outputSchema: reflectionReportSchema as Tool["outputSchema"]
  },
  {
    name: "retrieve_evidence",
    description: "Retrieve relevant evidence cards from the RAG store based on query",
    inputSchema: retrieveInputSchema as Tool["inputSchema"],
    outputSchema: evidenceCardListSchema as Tool["outputSchema"]
  },
  {
    name: "render_with_pointers",
    description: "Render content with embedded pointers to evidence sources and citations",
    inputSchema: renderInputSchema as Tool["inputSchema"],
    outputSchema: renderOutputSchema as Tool["outputSchema"]
  }
];
