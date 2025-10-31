import { retriever } from "../rag/retriever.js";
import { EvidenceCardList } from "../schemas/evidenceCard.js";

export async function retrieveEvidence(input: { query: string; topK?: number; filters?: any }) {
  if (!input?.query) throw new Error("Missing query");
  const cards = await retriever.search(input.query, input.topK ?? 8, input.filters);
  return EvidenceCardList.parse({ items: cards });
}
