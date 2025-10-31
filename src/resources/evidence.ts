import { getEvidenceByPointer, loadEvidenceSnapshot } from "../rag/evidenceStore.js";

export function router() {
  return async (path: string) => {
    const normalized = (path ?? "").trim();
    if (normalized === "" || normalized === "/") {
      const snapshot = await loadEvidenceSnapshot();
      return snapshot.records.map(record => ({
        pointer: record.pointer,
        title: record.title,
        updatedAt: record.updatedAt,
        sourceUrl: record.sourceUrl
      }));
    }

    const segments = normalized.replace(/^\/+/, "").split("/").filter(Boolean);
    if (segments[0] === "pointer" && segments[1]) {
      const pointer = decodeURIComponent(segments.slice(1).join("/"));
      const record = await getEvidenceByPointer(pointer);
      if (!record) {
        return { error: "not_found", pointer };
      }
      return record;
    }

    return { error: "unsupported_path", path };
  };
}
