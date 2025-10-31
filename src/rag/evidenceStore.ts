import { env } from "../config/env.js";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export type Passage = { id: string; title: string; text: string; anchors: string[]; hash: string; sourceUrl?: string; updatedAt?: string; };

export function loadSampleEvidence(): Passage[] {
  const p = join(process.cwd(), "tests/e2e/fixtures/sample-evidence.json");
  if (!existsSync(p)) return [];
  const arr = JSON.parse(readFileSync(p, "utf8"));
  return arr;
}
