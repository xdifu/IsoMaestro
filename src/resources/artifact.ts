import { env } from "../config/env.js";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

export function router() {
  return async (path: string) => {
    const baseDir = env.artifactsDir;
    const normalized = (path ?? "").trim();
    const segments = normalized.replace(/^\/+/, "").split("/").filter(Boolean);

    if (normalized === "" || normalized === "/") {
      const entries = await readdir(baseDir, { withFileTypes: true }).catch(() => []);
      const runs = await Promise.all(entries
        .filter(entry => entry.isDirectory())
        .map(async entry => {
          const folder = join(baseDir, entry.name);
          const files = await readdir(folder).catch(() => []);
          return { runId: entry.name, files };
        }));
      return runs;
    }

    if (segments.length === 1) {
      const runId = segments[0];
      const folder = join(baseDir, runId);
      const files = await readdir(folder).catch(() => null);
      if (!files) return { error: "not_found", runId };
      return { runId, files };
    }

    const runId = segments[0];
    const relative = segments.slice(1).join("/");
    const file = join(baseDir, runId, relative);
    const info = await stat(file).catch(() => null);
    if (!info) {
      return { error: "not_found", runId, file: relative };
    }
    if (info.isDirectory()) {
      const files = await readdir(file).catch(() => []);
      return { runId, path: relative, files };
    }
    if (relative.endsWith(".json")) {
      const data = await readFile(file, "utf8");
      try {
        return JSON.parse(data);
      } catch {
        return { runId, path: relative, content: data };
      }
    }
    const data = await readFile(file);
    return {
      runId,
      path: relative,
      encoding: "base64",
      data: data.toString("base64")
    };
  };
}
