# IsoMaestro

A long-lived MCP server exposing tools/resources/prompts over STDIO:
- Planner → Translator (one-shot capsule) → Sandboxed Executor → Reflector
- Pointer-first RAG: only EvidenceCard pointers in context; server orchestration retrieves, synthesises and validates citations.
- Sandbox runner interprets structured step plans: retrieve evidence → synthesize draft → render with pointer validation.
- Safety: minimal privileges, network/tool allowlists, one-shot capsule reuse protection.
- Observability: ndjson logs (`log://`), persisted artifacts (`artifact://`), pointer catalog validation, e2e tests, CI.

## Quickstart
````
npm install
npm run build
npm run mcp
````

Configure your MCP-compatible client (e.g., editor assistant) with:

* command: `node`
* args: `dist/server.js`
* transport: `stdio`

## Tools

* plan_task → TaskContract
* retrieve_evidence → EvidenceCard[]
* compile_capsule → ExecutionCapsule (oneShot, structured step plan)
* run_capsule → RunResult (sandbox orchestration + pointer citations)
* reflect_pipeline → ReflectionReport
* render_with_pointers → Final render with verified citations

## LLM 集成（Sampling）

IsoMaestro 会优先通过宿主（如 VS Code / GitHub Copilot）提供的 **MCP Sampling** 能力请求 LLM 采样：

1. Planner / Translator 在运行时会先调用 `sampling/createMessage`，由宿主端使用用户授权的模型生成计划与 stepPlan。
2. 宿主若未授权或不支持 sampling，服务端自动降级为规则化策略，确保流程稳定运行。
3. 所有 LLM 交互都遵循“最小上下文”原则：步骤之间仅通过结构化产物（EvidenceCard 指针等）传递信息。

> **提示**：默认关闭 sampling。若部署端启用了宿主采样功能，设置 `SAMPLING_ENABLED=1` 后重新启动即可自动协商 capabilities。

## Resources

* `evidence://` — 读取指针目录和单条证据（来自本地缓存，可选远程同步）。
* `artifact://` — 每次执行生成的结构化产物（例如 `artifact://run_<id>/final.json`）。
* `log://` — 每次执行的 ndjson 日志（`log://run_<id>`）。

## Prompts

* planner_system
* translator_system
* reflector_criteria

## 配置说明

以下环境变量可用于自定义部署行为（均可选）：

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `SAMPLING_ENABLED` | `""` | 设置为 `1` 时向客户端声明 sampling 能力；否则自动降级本地规则。 |
| `REMOTE_EVIDENCE_URL` | `""` | 可选远程证据服务（返回 JSON 数组）；会自动同步到本地缓存。 |
| `EVIDENCE_DATA_DIR` | `./data/evidence` | 本地证据缓存目录。首次启动若无文件会写入示例数据。 |
| `ARTIFACTS_DIR` | `./artifacts` | 执行产物输出目录（每个 run 一个子目录）。 |
| `LOG_DIR` | `./logs` | Sandboxed runner 日志目录（ndjson）。 |

## Security Defaults

* Capsule one-shot CAS
* No outbound network by default
* Step-level tool allowlists & placeholder resolution guardrails
* All external I/O via adapters with policy guard
* Render-time pointer validation (fail-closed)

## Roadmap

* Docker/Firejail sandbox runner
* 可选向量检索后端（本地/云）
* OTEL exporter & metrics dashboard

MIT License
