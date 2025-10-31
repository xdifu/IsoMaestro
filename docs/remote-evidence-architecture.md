# Remote Evidence Store Architecture for IsoMaestro

## Goals
- Provide a resilient remote evidence store that feeds IsoMaestro's pointer-first pipeline without bloating context windows [ref:ev://sample/doc2#p0?v=h2]
- Preserve deterministic pointer validation so sandboxed capsules can trust retrieved citations [ref:ev://sample/doc2#p0?v=h2]
- Improve retrieval throughput for complex tasks by layering caching and concurrency controls [ref:ev://sample/doc1#p0?v=h1]

## Functional Requirements
- **Pointer compatibility**: evidence entries must expose stable `ev://` pointers and metadata required by `render_with_pointers`.
- **Read optimisation**: support batched `retrieve_evidence` calls with configurable `topK`, filter predicates, and pagination.
- **Cache awareness**: expose cache-hit telemetry to the MCP observability channel so planning agents can adapt budgets.
- **Concurrency**: allow parallel retrievals spawned by `maxParallel` capsules without pointer collisions or stale responses.
- **Integrity hooks**: surface revision hashes so translator/run stages can detect outdated cards.

## Non-Functional Requirements
- Maintain deterministic fallbacks when remote sampling is unavailable by keeping a local sample dataset for smoke tests [ref:ev://sample/doc1#p0?v=h1]
- Provide SLOs: 50 ms P95 cache hits, 250 ms P95 cache misses, and end-to-end pointer validation within 20 ms.
- Support horizontal scaling across executors while keeping connection limits per worker configurable.

## Proposed Architecture
- **Evidence API Gateway**  
  Terminates MCP-originating requests, authenticates per capsule, enforces tool allowlists, and forwards to the evidence service.
- **Evidence Service Core**  
  Handles query planning, applies filter constraints, and consolidates sharded search indexes. Emits pointer metadata enriched with revision hashes.
- **Caching Tier**  
  Combines an L1 in-memory cache on each sandbox runner with an L2 distributed cache. Entries are keyed by `(query, filters, revision)` to avoid stale pointer reuse.
- **Storage Backends**  
  - Fast vector store and inverted index for fresh documents.  
  - Cold archive bucket with TTL-based promotion into the hot tier.  
  - Pointer catalog tracking pointer-to-hash mappings for validation.
- **Validation & Observability**  
  Pointer validator service recomputes hashes on cache fill and streams results to `log://` resources. Errors trigger automatic capsule aborts.

## Data Flow
1. Capsule issues `retrieve_evidence` twice in parallel (primary + secondary query). Translator guarantees isolation IDs for each branch.
2. Gateway authenticates capsule, enforces rate limits, and forwards to Evidence Service.
3. Evidence Service checks L1 cache; on miss, it fans out to L2 cache and storage backends.
4. Responses include pointer metadata; validation pipeline recomputes hashes and stores audit entries linked to run IDs.
5. Capsule synthesis step consumes merged card lists, produces draft, and `render_with_pointers` validates citations before final output.

## Concurrency & Consistency Strategy
- Use optimistic concurrency with revision hashes to detect write-skew; any mismatch forces a re-fetch before pointer issuance.
- Apply per-capsule request budgets derived from the TaskContract and propagate them through `ExecutionCapsule.envSpec`.
- Adopt circuit breakers on cache backends to degrade gracefully to deterministic local fixtures when remote components fail [ref:ev://sample/doc1#p0?v=h1].

## Safety Considerations
- Deny inline full-text payloads; only surface pointer IDs plus summaries to stay compliant with the pointer-first mandate [ref:ev://sample/doc2#p0?v=h2].
- Run pointer validation synchronously inside the sandbox runner to maintain fail-closed semantics.
- Emit structured metrics to `log://` for monitoring cache hit ratios, pointer validation latencies, and revision mismatches.

## Rollout Plan
1. Ship the remote evidence store behind a feature flag; keep local fixtures for regression tests.
2. Instrument planner and translator to detect the new capability via feature toggles and adjust retrieval budgets accordingly.
3. Gradually raise `maxParallel` limits once cache hit ratios meet the SLO; capture regressions through existing end-to-end tests.
4. Document operational playbooks (cache warm-up, reindexing, failover) and integrate with the reflector for post-run diagnostics.
