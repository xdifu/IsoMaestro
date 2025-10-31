# IsoMaestro

A long-lived MCP server exposing tools/resources/prompts over STDIO:
- Planner → Translator (one-shot capsule) → Sandboxed Executor → Reflector
- Pointer-first RAG: only EvidenceCard pointers in context; server-side render-time resolution.
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
* compile_capsule → ExecutionCapsule (oneShot)
* run_capsule → RunResult (artifacts/logs pointers)
* reflect_pipeline → ReflectionReport
* render_with_pointers → Final render with verified citations

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
* All external I/O via adapters with policy guard
* Render-time pointer validation (fail-closed)

## Roadmap

* Docker/Firejail sandbox runner
* Real evidence store & artifact/log backends
* OTEL exporter & metrics dashboard

MIT License

