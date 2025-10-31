import { store } from "../store/kv.js";
import { usedCapsules } from "../store/usedCapsules.js";
import { ExecutionCapsule } from "../schemas/executionCapsule.js";
import { RunResult } from "../schemas/runResult.js";
import { sandboxRunner } from "../sandbox/runner.js";
import { env } from "../config/env.js";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { logger } from "../observability/logger.js";

async function persistRunArtifacts(runId: string, output: unknown, logs: string[]) {
  const artifactDir = join(env.artifactsDir, runId);
  const logDir = env.logsDir;

  await Promise.all([
    mkdir(artifactDir, { recursive: true }),
    mkdir(logDir, { recursive: true })
  ]);

  const artifactFile = join(artifactDir, "final.json");
  const logFile = join(logDir, `${runId}.ndjson`);

  const serializedOutput = JSON.stringify(output ?? null, null, 2);
  await writeFile(artifactFile, serializedOutput, "utf8");

  const now = new Date();
  const entries = logs.map((line, index) =>
    JSON.stringify({ ts: new Date(now.getTime() + index).toISOString(), line, seq: index })
  );
  const payload = entries.length ? entries.join("\n") + "\n" : "";
  await writeFile(logFile, payload, "utf8");

  return {
    artifactUri: `artifact://${runId}/final.json`,
    logUri: `log://${runId}`
  };
}

export async function runCapsule(input: { capsuleId?: string; capsule?: any }) {
  const capsule = ExecutionCapsule.parse(
    input?.capsule ?? await store.get("capsules", input?.capsuleId!)
  );

  await usedCapsules.ensureUnusedOrThrow(capsule.id);

  let rawResult: any;
  try {
    rawResult = await sandboxRunner.run(capsule);
  } catch (error) {
    await usedCapsules.markUsed(capsule.id).catch(() => {});
    logger.error({
      msg: "run_capsule_failed",
      capsuleId: capsule.id,
      error: (error as Error).message
    });
    throw error;
  }

  await usedCapsules.markUsed(capsule.id);

  const { artifactUri, logUri } = await persistRunArtifacts(
    rawResult.id,
    rawResult.output,
    rawResult.logs ?? []
  );

  const artifacts = Array.from(
    new Set([...(rawResult.artifacts ?? []), artifactUri])
  );

  const runRecord = RunResult.parse({
    ...rawResult,
    artifacts
  });

  await store.save("runs", runRecord.id, runRecord);
  logger.info({
    msg: "run_capsule_completed",
    runId: runRecord.id,
    capsuleId: capsule.id,
    artifactUri,
    logUri
  });
  return runRecord;
}
