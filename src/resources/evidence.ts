import { loadSampleEvidence } from "../rag/evidenceStore.js";
export function router() {
  return async (path: string) => {
    // 演示：列出样例证据库
    if (path === "" || path === "/") {
      return loadSampleEvidence().map(p => ({ id: p.id, title: p.title }));
    }
    return { error: "not_implemented" };
  };
}
