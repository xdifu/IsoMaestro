# IsoMaestro

A long-lived MCP server exposing tools/resources/prompts over STDIO:
- Planner → Translator (one-shot capsule) → Sandboxed Executor → Reflector
- Pointer-first RAG: only EvidenceCard pointers in context; server orchestration retrieves, synthesises and validates citations.
- Sandbox runner interprets structured step plans: retrieve evidence → synthesize draft → render with pointer validation.
- Safety: minimal privileges, network/tool allowlists, one-shot capsule reuse protection.
- Observability: ndjson logs (log://), basic metrics, e2e tests, CI.

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

## Resources

* evidence://  (read-only pointers & listings)
* artifact://   (artifacts; placeholder in MVP)
* log://        (structured logs; placeholder in MVP)

## Prompts

* planner_system
* translator_system
* reflector_criteria

## Security Defaults

* Capsule one-shot CAS
* No outbound network by default
* Step-level tool allowlists & placeholder resolution guardrails
* All external I/O via adapters with policy guard
* Render-time pointer validation (fail-closed)

## Roadmap

* Docker/Firejail sandbox runner
* Real evidence store & artifact/log backends
* OTEL exporter & metrics dashboard

MIT License
