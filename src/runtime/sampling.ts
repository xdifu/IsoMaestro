import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { CreateMessageResult } from "@modelcontextprotocol/sdk/types.js";
import { logger } from "../observability/logger.js";

const SAMPLING_TIMEOUT_MS = 2000;

let serverInstance: Server | null = null;
let samplingEnabled = false;

export function attachSamplingServer(server: Server | null, enabled: boolean) {
  serverInstance = enabled ? server : null;
  samplingEnabled = enabled && !!server;
  logger.debug({
    msg: "sampling_attach",
    enabled: samplingEnabled
  });
}

export function isSamplingAvailable(): boolean {
  return samplingEnabled && serverInstance !== null;
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
  if (!isSamplingAvailable()) {
    logger.debug({ msg: "sampling_skipped", reason: "disabled" });
    return null;
  }
  const description = request.description ?? "unnamed";
  try {
    const result = await serverInstance!.createMessage({
      systemPrompt: request.systemPrompt,
      messages: request.messages,
      maxTokens: request.maxTokens,
      temperature: request.temperature,
      stopSequences: request.stopSequences,
      includeContext: request.includeContext,
      metadata: request.metadata,
      modelPreferences: request.modelPreferences
    } as any, { timeout: SAMPLING_TIMEOUT_MS });
    logger.debug({ msg: "sampling_success", request: description });
    return result;
  } catch (error) {
    logger.warn({
      msg: "sampling_failed",
      error: (error as Error).message,
      request: description
    });
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
