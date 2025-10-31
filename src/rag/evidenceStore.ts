import { env } from "../config/env.js";
import { encodePointer } from "./pointer.js";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { fetch } from "undici";
import { logger } from "../observability/logger.js";

export interface EvidenceRecord {
  pointer: string;
  collection: string;
  docId: string;
  fragment: string;
  hash: string;
  title: string;
  summary: string;
  text?: string;
  anchors: string[];
  sourceUrl?: string;
  updatedAt?: string;
  tags?: string[];
}

export interface EvidenceSnapshot {
  records: EvidenceRecord[];
  revision: string;
}

const FALLBACK_FIXTURE = join(process.cwd(), "tests/e2e/fixtures/sample-evidence.json");
const EVIDENCE_INDEX = join(env.evidenceDir, "index.json");
const CACHE_TTL_MS = 30_000;
const REMOTE_SYNC_INTERVAL_MS = 60_000;

let cachedSnapshot: EvidenceSnapshot | null = null;
let cachedAt = 0;
let cachedMtime = 0;
const pointerIndex = new Map<string, EvidenceRecord>();
let lastRemoteSync = 0;

async function ensureEvidenceIndex(): Promise<void> {
  await mkdir(env.evidenceDir, { recursive: true });
  try {
    await access(EVIDENCE_INDEX, fsConstants.R_OK);
  } catch {
    // 严格模式：禁止使用示例索引，直接报错
    if (env.strictEvidence) {
      throw new Error(
        `Evidence index missing and STRICT_EVIDENCE_MODE=1. Please provision a real index at ${EVIDENCE_INDEX} or set REMOTE_EVIDENCE_URL.`
      );
    }
    // 仅在开发/测试场景允许回退示例
    if (!env.allowSampleEvidence) {
      throw new Error(
        `Evidence index missing and ALLOW_SAMPLE_EVIDENCE is not set. Please provision a real index at ${EVIDENCE_INDEX} or set REMOTE_EVIDENCE_URL.`
      );
    }
    const fallback = await readFile(FALLBACK_FIXTURE, "utf8").catch(() => null);
    if (!fallback) {
      throw new Error(`Evidence index missing and sample fallback not found at ${FALLBACK_FIXTURE}`);
    }
    await writeFile(EVIDENCE_INDEX, fallback, "utf8");
    logger.warn({ msg: "evidence_fallback_sample_used", path: FALLBACK_FIXTURE });
  }
}

async function readSnapshotFromDisk(): Promise<EvidenceSnapshot> {
  await ensureEvidenceIndex();
  const [raw, meta] = await Promise.all([
    readFile(EVIDENCE_INDEX, "utf8"),
    stat(EVIDENCE_INDEX)
  ]);

  let parsed: Array<Record<string, unknown>>;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse evidence index: ${(error as Error).message}`);
  }

  pointerIndex.clear();
  const records: EvidenceRecord[] = parsed.map((entry) => normaliseRecord(entry));
  records.forEach((record) => pointerIndex.set(record.pointer, record));

  const hash = createHash("sha256").update(raw).digest("hex");
  cachedMtime = meta.mtimeMs;

  return {
    records,
    revision: hash
  };
}

function normaliseRecord(entry: Record<string, unknown>): EvidenceRecord {
  const collection = typeof entry.collection === "string" && entry.collection ? entry.collection : "external";
  const docId = String(entry.id ?? entry.docId ?? "");
  if (!docId) {
    throw new Error("Evidence record missing id");
  }
  const fragment = typeof entry.fragment === "string" && entry.fragment ? entry.fragment : "p0";
  const hash = String(entry.hash ?? "");
  if (!hash) {
    throw new Error(`Evidence record ${docId} missing hash`);
  }
  const pointer = typeof entry.pointer === "string" && entry.pointer
    ? entry.pointer
    : encodePointer(collection, docId, fragment, hash);
  const title = String(entry.title ?? docId);
  const summarySource = typeof entry.summary === "string" && entry.summary.length > 0
    ? entry.summary
    : typeof entry.text === "string"
      ? entry.text.slice(0, 400).trim()
      : "";
  const anchors = Array.isArray(entry.anchors) ? entry.anchors.map(String) : [];
  const text = typeof entry.text === "string" ? entry.text : undefined;
  const sourceUrl = typeof entry.sourceUrl === "string" ? entry.sourceUrl : undefined;
  const updatedAt = typeof entry.updatedAt === "string" ? entry.updatedAt : undefined;
  const tags = Array.isArray(entry.tags) ? entry.tags.map(String) : undefined;

  return {
    pointer,
    collection,
    docId,
    fragment,
    hash,
    title,
    summary: summarySource,
    text,
    anchors,
    sourceUrl,
    updatedAt,
    tags
  };
}

export async function loadEvidenceSnapshot(force = false): Promise<EvidenceSnapshot> {
  const now = Date.now();
  if (!force && cachedSnapshot && now - cachedAt < CACHE_TTL_MS) {
    return cachedSnapshot;
  }

  await ensureEvidenceIndex();
  await maybeRefreshFromRemote();

  const meta = await stat(EVIDENCE_INDEX).catch(() => null);
  if (
    !force &&
    cachedSnapshot &&
    meta &&
    cachedAt > 0 &&
    meta.mtimeMs === cachedMtime &&
    now - cachedAt < CACHE_TTL_MS
  ) {
    cachedAt = now;
    return cachedSnapshot;
  }

  const snapshot = await readSnapshotFromDisk();
  cachedSnapshot = snapshot;
  cachedAt = now;
  return snapshot;
}

export async function getEvidenceByPointer(pointer: string): Promise<EvidenceRecord | null> {
  const normalised = pointer;
  const current = pointerIndex.get(normalised);
  if (current) return current;
  await loadEvidenceSnapshot(true);
  return pointerIndex.get(normalised) ?? null;
}

async function maybeRefreshFromRemote(): Promise<void> {
  if (!env.remoteEvidenceUrl) return;
  const now = Date.now();
  if (now - lastRemoteSync < REMOTE_SYNC_INTERVAL_MS) return;
  lastRemoteSync = now;
  try {
    const response = await fetch(env.remoteEvidenceUrl, { headers: { accept: "application/json" } });
    if (!response.ok) {
      logger.warn({ msg: "evidence_remote_fetch_failed", status: response.status });
      return;
    }
    const payload = await response.text();
    if (!payload) return;
    await writeFile(EVIDENCE_INDEX, payload, "utf8");
    logger.info({ msg: "evidence_remote_fetched", bytes: payload.length });
    cachedSnapshot = null;
  } catch (error) {
    logger.warn({ msg: "evidence_remote_error", error: (error as Error).message });
  }
}

export async function appendEvidenceRecord(partial: Omit<EvidenceRecord, "pointer">): Promise<EvidenceRecord> {
  // Load latest snapshot from disk
  const snap = await loadEvidenceSnapshot(true);
  const pointer = encodePointer(partial.collection, partial.docId, partial.fragment, partial.hash);
  const record: EvidenceRecord = { ...partial, pointer };

  // Append and persist
  const next = [...snap.records, record];
  const json = JSON.stringify(next, null, 2);
  await writeFile(EVIDENCE_INDEX, json, "utf8");

  // Refresh in-memory indices
  pointerIndex.set(pointer, record);
  cachedSnapshot = null;
  await loadEvidenceSnapshot(true);
  logger.info({ msg: "evidence_appended", pointer, collection: record.collection });
  return record;
}
