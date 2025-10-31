import { v4 as uuid } from "uuid";
import { createHash } from "node:crypto";
import { EvidenceCardList, EvidenceCardT } from "../schemas/evidenceCard.js";
import { isSamplingAvailable, trySampleMessage, extractTextContent } from "../runtime/sampling.js";
import { appendEvidenceRecord } from "../rag/evidenceStore.js";
import { logger } from "../observability/logger.js";

type Input = { query: string; context?: string; maxChars?: number };

export async function generateEvidence(input: Input) {
  if (!input?.query) throw new Error("Missing query");

  const maxChars = Math.max(200, Math.min(4000, input.maxChars ?? 1200));

  const content = await generateContentWithSampling(input.query, input.context, maxChars);
  if (!content) {
    throw new Error("EVIDENCE_GENERATION_FAILED");
  }

  const docId = `gen_${uuid()}`;
  const fragment = "p0";
  const baseForHash = content.text ?? content.summary ?? input.query;
  const hash = createHash("sha256").update(baseForHash).digest("hex");

  const record = await appendEvidenceRecord({
    collection: "generated",
    docId,
    fragment,
    hash,
    title: content.title || input.query.slice(0, 80),
    summary: (content.summary || content.text || input.query).slice(0, 600),
    text: content.text?.slice(0, maxChars),
    anchors: content.anchors ?? [],
    sourceUrl: content.sourceUrl,
    updatedAt: new Date().toISOString(),
    tags: ["ai_generated"]
  });

  const card: EvidenceCardT = {
    id: record.pointer,
    title: record.title,
    summary: record.summary,
    anchors: record.anchors ?? [],
    freshness: record.updatedAt ?? "",
    confidence: 1,
    sourceUrl: record.sourceUrl
  };

  return EvidenceCardList.parse({ items: [card] });
}

async function generateContentWithSampling(query: string, context?: string, maxChars?: number): Promise<{ title?: string; summary?: string; text?: string; anchors?: string[]; sourceUrl?: string } | null> {
  if (!isSamplingAvailable()) {
    logger.warn({ msg: "evidence_sampling_unavailable" });
    // 回退：在无采样可用时，使用查询文本生成最小可用证据
    return { title: query.slice(0, 80), summary: (context ? `${query} — ${context}` : query).slice(0, maxChars || 600) };
  }
  const systemPrompt = [
    "You are an evidence generator.",
    "Given a user query, produce a short title, a concise summary, and if appropriate a short explanatory text.",
    "Return JSON only: { title, summary, text?, anchors? }",
    "Do not include code fences or additional commentary."
  ].join(" \n");

  const userPayload = JSON.stringify({ query, context, maxChars });
  const result = await trySampleMessage({
    description: "generate_evidence",
    systemPrompt,
    messages: [
      { role: "user", content: { type: "text", text: userPayload } }
    ],
    includeContext: "thisServer",
    maxTokens: 900,
    temperature: 0.3,
    modelPreferences: { intelligencePriority: 0.9 }
  } as any);

  const text = extractTextContent(result);
  if (!text) return null;
  const cleaned = sanitiseJsonCandidate(text);
  if (!cleaned) return null;
  try {
    const obj = JSON.parse(cleaned);
    if (!obj || typeof obj !== "object") return null;
    return obj;
  } catch (e) {
    logger.warn({ msg: "evidence_parse_failed", error: (e as Error).message });
    return null;
  }
}

function sanitiseJsonCandidate(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let cleaned = trimmed.replace(/```json|```/gi, "").trim();
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  return cleaned.slice(first, last + 1);
}
