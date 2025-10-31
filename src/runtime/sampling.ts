import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { CreateMessageResult } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../observability/logger.js";

let serverInstance: Server | null = null;

export function attachSamplingServer(server: Server) {
  serverInstance = server;
}

export interface SamplingMessage {
  role: "user" | "assistant";
  content: 
    | { type: "text"; text: string }
    | { type: "image"; data: string; mimeType: string }
    | { type: "audio"; data: string; mimeType: string };
}

export interface SamplingRequest {
  description?: string;
  systemPrompt?: string;
  messages: SamplingMessage[];
  maxTokens: number;
  temperature?: number;
  stopSequences?: string[];
  includeContext?: "none" | "thisServer" | "allServers";
  metadata?: Record<string, unknown>;
  modelPreferences?: {
    hints?: Array<{ name?: string }>;
    costPriority?: number;
    speedPriority?: number;
    intelligencePriority?: number;
  };
}

export async function trySampleMessage(request: SamplingRequest): Promise<CreateMessageResult | null> {
  if (!serverInstance) {
    logger.debug({ msg: "sampling_skipped", reason: "no_server" });
    return null;
  }
  try {
    const result = await serverInstance.createMessage({
      systemPrompt: request.systemPrompt,
      messages: request.messages,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      stopSequences: request.stopSequences,
      includeContext: request.includeContext,
      metadata: request.metadata,
      modelPreferences: request.modelPreferences
    } as any);
    logger.debug({ msg: "sampling_success", request: request.description ?? "unnamed" });
    return result;
  } catch (error) {
    logger.warn({ msg: "sampling_failed", error: (error as Error).message, request: request.description ?? "unnamed" });
    return null;
  }
}

export function extractTextContent(result: CreateMessageResult | null): string | null {
  if (!result) return null;
  const { content } = result;
  if (!content) return null;
  
  // Handle content as array (per MCP spec: ContentBlock[])
  if (Array.isArray(content)) {
    const primary = content.find(item => item.type === "text");
    if (primary && "text" in primary) {
      return typeof primary.text === "string" ? primary.text : null;
    }
    return null;
  }
  
  // Handle single content block
  if (typeof content === "object" && "type" in content) {
    if (content.type === "text" && "text" in content) {
      return typeof content.text === "string" ? content.text : null;
    }
  }
  
  return null;
}
