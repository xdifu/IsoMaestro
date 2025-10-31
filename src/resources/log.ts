import { env } from "../config/env.js";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export function router() {
  return async (path: string) => {
    const baseDir = env.logsDir;
    const normalized = (path ?? "").trim();

    if (normalized === "" || normalized === "/") {
      const items = await readdir(baseDir, { withFileTypes: true }).catch(() => []);
      const summaries = await Promise.all(items
        .filter(entry => entry.isFile() && entry.name.endsWith(".ndjson"))
        .map(async entry => {
          const full = join(baseDir, entry.name);
          const info = await stat(full).catch(() => null);
          return {
            logId: entry.name.replace(/\.ndjson$/, ""),
            bytes: info?.size ?? 0,
            updatedAt: info?.mtime.toISOString()
          };
        }));
      return summaries;
    }

    const trimmed = normalized.replace(/^\/+/, "");
    const target = trimmed.endsWith(".ndjson") ? trimmed : `${trimmed}.ndjson`;
    const file = join(baseDir, target);
    const contents = await readFile(file, "utf8").catch(() => null);
    if (!contents) {
      return { error: "not_found", path };
    }
    const entries = contents
      .split("\n")
      .filter(Boolean)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return { ts: null, line };
        }
      });
    return { logId: trimmed.replace(/\.ndjson$/, ""), entries };
  };
}
