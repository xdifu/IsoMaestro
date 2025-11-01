# IsoMaestro

A long-lived MCP server exposing tools/resources/prompts over STDIO:
- Planner → Translator (one-shot capsule) → Sandboxed Executor → Reflector
- Pointer-first RAG: only EvidenceCard pointers in context; server orchestration retrieves, synthesises and validates citations.
- Sandbox runner interprets structured step plans: retrieve evidence → synthesize draft → render with pointer validation.
- Safety: minimal privileges, network/tool allowlists, one-shot capsule reuse protection.
- Observability: ndjson logs (`log://`), persisted artifacts (`artifact://`), pointer catalog validation, e2e tests, CI.

## Quickstart

### Option 1: STDIO Transport (Default)
```bash
npm install
npm run build
npm run mcp
```

Configure your MCP-compatible client with:
- command: `node`
- args: `dist/server.js`
- transport: `stdio`

### Option 2: HTTP/SSE Transport (Recommended for Sampling)
```bash
npm install
npm run build
SAMPLING_ENABLED=1 npm run mcp-http
```

Configure your MCP-compatible client with:
- type: `sse`
- url: `http://localhost:3001/sse`
- headers: (optional authentication)

Or use the provided `mcp.json` configuration file.

## Tools

* plan_task → TaskContract
* generate_evidence → EvidenceCard[]（采样生成并持久化证据，返回指针）
* retrieve_evidence → EvidenceCard[]（从证据库检索指针）
* compile_capsule → ExecutionCapsule（oneShot，结构化步骤计划）
* run_capsule → RunResult（沙盒编排 + 指针校验 + 产物/日志持久化）
* reflect_pipeline → ReflectionReport
* render_with_pointers → 最终渲染并验证指针

## LLM 集成（Sampling）

IsoMaestro 通过 **MCP Sampling** 协议与宿主（如 Claude）集成进行 LLM 采样：

### 采样工作原理
1. 服务端声明 `sampling: {}` 能力
2. 当需要 LLM 生成时，发送 `sampling/createMessage` 请求给客户端
3. 客户端使用用户授权的模型生成内容并返回
4. 服务端处理响应并继续执行

### 传输方式
- **STDIO**: 本地进程间通信，采样请求超时（不支持）
- **HTTP/SSE**: 网络连接，Claude 可处理采样请求 ✅

### 配置采样
```bash
# 启用采样
export SAMPLING_ENABLED=1

# 使用 HTTP 服务器（推荐）
npm run mcp-http

# 或使用 STDIO（采样不可用）
npm run mcp
```

> **重要**：采样需要 MCP 客户端（如 Claude）支持 `sampling/createMessage` 处理程序。STDIO 传输不支持采样。

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
| `STRICT_EVIDENCE_MODE` | `""` | 设为 `1` 启用严格证据模式：缺少索引时严禁使用示例，必须提供真实数据或 REMOTE_EVIDENCE_URL。 |
| `ALLOW_SAMPLE_EVIDENCE` | `""` | 设为 `1` 在本地开发/测试时允许使用示例索引回退（生产环境严禁开启）。 |

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
