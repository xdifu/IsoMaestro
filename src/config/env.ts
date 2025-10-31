export type ModelKind = "openai" | "anthropic" | "local";

export const env = {
  model: (process.env.MODEL_KIND as ModelKind) ?? "local",
  openaiKey: process.env.OPENAI_API_KEY ?? "",
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  localModelUrl: process.env.LOCAL_MODEL_URL ?? "",
  evidenceDir: process.env.EVIDENCE_DATA_DIR ?? "./data/evidence",
  artifactsDir: process.env.ARTIFACTS_DIR ?? "./artifacts",
  logsDir: process.env.LOG_DIR ?? "./logs",
  remoteEvidenceUrl: process.env.REMOTE_EVIDENCE_URL ?? "",
  // 严格证据模式：开启后禁止任何示例回退，证据索引缺失将报错
  strictEvidence: process.env.STRICT_EVIDENCE_MODE === "1",
  // 仅用于开发/测试：允许在本地缺少索引时回退到示例
  allowSampleEvidence: process.env.ALLOW_SAMPLE_EVIDENCE === "1",
  samplingEnabled: process.env.SAMPLING_ENABLED === "1",
  otelEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
};
