import { EvidenceCardT } from "../schemas/evidenceCard.js";
import { encodePointer } from "./pointer.js";
import { loadSampleEvidence, Passage } from "./evidenceStore.js";

const STOP_WORDS = new Set([
  "the","a","an","to","and","of","in","on","for","with","by","at","is","are","was","were","be","been","from","that","this","it"
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => !STOP_WORDS.has(token));
}

function applyFilters(passages: Passage[], filters?: any): Passage[] {
  if (!filters) return passages;
  let current = passages;
  if (filters.source) {
    current = current.filter(p => (p.sourceUrl ?? "").includes(String(filters.source)));
  }
  if (filters.after) {
    const cutoff = new Date(filters.after).getTime();
    current = current.filter(p => !p.updatedAt || new Date(p.updatedAt).getTime() >= cutoff);
  }
  return current;
}

export const retriever = {
  async search(query: string, topK: number, filters?: any): Promise<EvidenceCardT[]> {
    const all = applyFilters(loadSampleEvidence(), filters);
    if (all.length === 0) return [];

    const queryTokens = tokenize(query);
    const uniqueTokens = new Set(queryTokens);
    const idf: Record<string, number> = {};

    uniqueTokens.forEach(tok => {
      const docCount = all.reduce((count, passage) => {
        const text = `${passage.title} ${passage.text}`.toLowerCase();
        return text.includes(tok) ? count + 1 : count;
      }, 0);
      idf[tok] = Math.log((all.length + 1) / (1 + docCount)) + 1;
    });

    const scored = all.map(passage => {
      const passageTokens = tokenize(`${passage.title} ${passage.text}`);
      const frequency: Record<string, number> = {};
      passageTokens.forEach(tok => {
        frequency[tok] = (frequency[tok] ?? 0) + 1;
      });
      let score = 0;
      queryTokens.forEach(tok => {
        const termFreq = frequency[tok] ?? 0;
        if (termFreq > 0) {
          score += termFreq * (idf[tok] ?? 1);
        }
      });
      // Reward anchor overlap
      const anchorBoost = (passage.anchors ?? []).some(anchor => queryTokens.includes(anchor.toLowerCase())) ? 0.5 : 0;
      const titleBoost = passage.title.toLowerCase().includes(query.toLowerCase()) ? 0.75 : 0;
      score += anchorBoost + titleBoost;

      return { passage, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, topK);
    const maxScore = top[0]?.score || 1;

    return top.map(({ passage, score }) => ({
      id: encodePointer("sample", passage.id, "p0", passage.hash),
      title: passage.title,
      summary: passage.text.slice(0, 400).trim(),
      anchors: passage.anchors ?? [],
      freshness: passage.updatedAt ?? "",
      confidence: Number((score / maxScore).toFixed(2)),
      sourceUrl: passage.sourceUrl
    }));
  }
};
