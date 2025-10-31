import { EvidenceCardT } from "../schemas/evidenceCard.js";
import { loadEvidenceSnapshot, EvidenceRecord } from "./evidenceStore.js";

const STOP_WORDS = new Set([
  "the", "a", "an", "to", "and", "of", "in", "on", "for", "with", "by", "at", "is", "are", "was", "were", "be", "been", "from", "that", "this", "it"
]);

type Filters = {
  source?: string;
  after?: string;
  tags?: string[];
};

const queryCache = new Map<string, { revision: string; expiresAt: number; cards: EvidenceCardT[] }>();
const CACHE_TTL_MS = 15_000;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter(token => !STOP_WORDS.has(token));
}

function normaliseFilters(filters?: Filters): Filters | undefined {
  if (!filters) return undefined;
  const normalised: Filters = {};
  if (filters.source) normalised.source = String(filters.source);
  if (filters.after) normalised.after = new Date(filters.after).toISOString();
  if (Array.isArray(filters.tags)) normalised.tags = [...new Set(filters.tags.map(tag => String(tag).toLowerCase()))].sort();
  return normalised;
}

function applyFilters(records: EvidenceRecord[], filters?: Filters): EvidenceRecord[] {
  if (!filters) return records;
  let current = records;
  if (filters.source) {
    const needle = filters.source.toLowerCase();
    current = current.filter(item => (item.sourceUrl ?? "").toLowerCase().includes(needle));
  }
  if (filters.after) {
    const cutoff = new Date(filters.after).getTime();
    current = current.filter(item => !item.updatedAt || new Date(item.updatedAt).getTime() >= cutoff);
  }
  if (filters.tags?.length) {
    current = current.filter(item => {
      const tags = item.tags ?? [];
      return filters.tags!.every(tag => tags.map(t => t.toLowerCase()).includes(tag));
    });
  }
  return current;
}

function cacheKey(query: string, topK: number, filters?: Filters, revision?: string): string {
  const base = query.trim().toLowerCase();
  const filterKey = filters ? JSON.stringify(filters) : "none";
  return `${base}|${topK}|${filterKey}|${revision ?? "rev"}`;
}

export const retriever = {
  async search(query: string, topK: number, filters?: Filters): Promise<EvidenceCardT[]> {
    const { records, revision } = await loadEvidenceSnapshot();
    const normalisedFilters = normaliseFilters(filters);
    const key = cacheKey(query, topK, normalisedFilters, revision);
    const cached = queryCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.cards.slice(0, topK);
    }

    const filtered = applyFilters(records, normalisedFilters);
    if (filtered.length === 0) return [];

    const queryTokens = tokenize(query);
    const uniqueTokens = new Set(queryTokens);
    const idf: Record<string, number> = {};

    uniqueTokens.forEach(tok => {
      const docCount = filtered.reduce((count, record) => {
        const text = `${record.title} ${record.summary} ${record.text ?? ""}`.toLowerCase();
        return text.includes(tok) ? count + 1 : count;
      }, 0);
      idf[tok] = Math.log((filtered.length + 1) / (1 + docCount)) + 1;
    });

    const scored = filtered.map(record => {
      const passageTokens = tokenize(`${record.title} ${record.summary} ${record.text ?? ""}`);
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
      const anchorBoost = (record.anchors ?? []).some(anchor => queryTokens.includes(anchor.toLowerCase())) ? 0.5 : 0;
      const titleBoost = record.title.toLowerCase().includes(query.toLowerCase()) ? 0.75 : 0;
      return { record, score: score + anchorBoost + titleBoost };
    });

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, topK);
    const maxScore = top[0]?.score || 1;

    const cards = top.map(({ record, score }) => ({
      id: record.pointer,
      title: record.title,
      summary: record.summary,
      anchors: record.anchors ?? [],
      freshness: record.updatedAt ?? "",
      confidence: Number((score / maxScore).toFixed(2)),
      sourceUrl: record.sourceUrl
    }));

    queryCache.set(key, {
      revision,
      cards,
      expiresAt: Date.now() + CACHE_TTL_MS
    });

    return cards;
  }
};
