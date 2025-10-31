import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export type PromptMessage = {
  role: "system" | "user" | "assistant";
  content: Array<{ type: "text"; text: string }>;
};

export type PromptDescriptor = {
  name: string;
  description: string;
  messages: PromptMessage[];
};

function loadText(filename: string): string {
  const candidatePaths = [
    join(here, filename),
    join(here, "../../src/prompts", filename)
  ];
  for (const candidate of candidatePaths) {
    try {
      return readFileSync(candidate, "utf8");
    } catch {
      /* try next path */
    }
  }
  throw new Error(`Prompt template not found: ${filename}`);
}

export const promptDescriptors: PromptDescriptor[] = [
  {
    name: "planner_system",
    description: "System prompt for the planner agent",
    messages: [
      {
        role: "system",
        content: [{ type: "text", text: loadText("planner_system.txt") }]
      }
    ]
  },
  {
    name: "translator_system",
    description: "System prompt for the translator agent",
    messages: [
      {
        role: "system",
        content: [{ type: "text", text: loadText("translator_system.txt") }]
      }
    ]
  },
  {
    name: "reflector_criteria",
    description: "Evaluation rubric used by the reflector agent",
    messages: [
      {
        role: "system",
        content: [{ type: "text", text: loadText("reflector_criteria.txt") }]
      }
    ]
  }
];

export function createPromptRegistry() {
  const byName = new Map(promptDescriptors.map((p) => [p.name, p]));
  return { promptList: promptDescriptors.map(({ name, description }) => ({ name, description })), promptMap: byName };
}
