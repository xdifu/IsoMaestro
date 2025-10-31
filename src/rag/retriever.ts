import { EvidenceCardT } from "../schemas/evidenceCard.js";
import { encodePointer } from "./pointer.js";
import { loadSampleEvidence } from "./evidenceStore.js";

export const retriever = {
  async search(query: string, topK: number, filters?: any): Promise<EvidenceCardT[]> {
    const all = loadSampleEvidence();
    const matched = all.filter(p => p.text.toLowerCase().includes(query.toLowerCase())).slice(0, topK);
    return matched.map(p => ({
      id: encodePointer("sample", p.id, "p0", p.hash),
      title: p.title,
      summary: p.text.slice(0, 400),
      anchors: p.anchors ?? [],
      freshness: p.updatedAt ?? "",
      confidence: 0.6,
      sourceUrl: p.sourceUrl
    }));
  }
};
