import { validatePointer } from "../rag/pointerCatalog.js";
import { logger } from "../observability/logger.js";

export async function renderWithPointers(input: { draft: string }) {
  if (!input?.draft) throw new Error("Missing draft");
  const refs = [...input.draft.matchAll(/\[ref:(ev:\/\/[^\]\s]+)\]/g)].map(m => m[1]);
  const unique = Array.from(new Set(refs));
  const failed: string[] = [];
  for (const pointer of unique) {
    const result = await validatePointer(pointer);
    if (!result.ok) {
      failed.push(pointer);
      logger.warn({
        msg: "pointer_validate_failed",
        pointer,
        reason: result.reason,
        expectedVersion: result.expectedVersion,
        actualVersion: result.actualVersion
      });
    }
  }
  if (failed.length) {
    return {
      ok: false,
      error: "POINTER_RESOLVE_FAILED",
      bad: failed
    };
  }
  logger.info({
    msg: "pointer_validate_pass",
    count: unique.length
  });
  return { ok: true, content: input.draft, citations: unique };
}
