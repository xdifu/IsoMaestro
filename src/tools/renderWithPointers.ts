import { parsePointer } from "../rag/pointer.js";

export async function renderWithPointers(input: { draft: string }) {
  if (!input?.draft) throw new Error("Missing draft");
  // 简化：查找 [ref:ev://...] 并校验格式
  const refs = [...input.draft.matchAll(/\[ref:(ev:\/\/[^\]\s]+)\]/g)].map(m => m[1]);
  const bad: string[] = [];
  for (const r of refs) {
    try { parsePointer(r); } catch { bad.push(r); }
  }
  if (bad.length) {
    return { ok: false, error: "POINTER_RESOLVE_FAILED", bad };
  }
  return { ok: true, content: input.draft, citations: refs };
}
