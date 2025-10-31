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
  samplingEnabled: process.env.SAMPLING_ENABLED === "1",
  otelEndpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT
};
