# IsoMaestro LLM 采样上下文使用分析（完成版）

## 结论摘要
- 采样基础设施完全支持 `includeContext`（`none | thisServer | allServers`），且已接入 MCP SDK 的 `createMessage`。
- Planner 与 Translator 历史上未显式设置 `includeContext`；现已修复为 `thisServer`。
- 影响：LLM 能够获知本服务能力并在采样时参考工具/资源上下文，提升计划/翻译质量。

## 证据
- 采样实现：`src/runtime/sampling.ts` 将 `includeContext` 透传给 `server.createMessage`，并设置 2s 超时回退。
- 修复点：
  - Planner：`src/agents/planner.ts` 在采样请求中加入 `includeContext: "thisServer"`（两次尝试策略保持）。
  - Translator：`src/agents/translator.ts` 在采样请求中加入 `includeContext: "thisServer"`（两次尝试策略保持）。

## 风险与权衡
- 兼容性：当客户端不支持 sampling 或拒绝时，服务端 2s 内回退，保持稳定。
- 隐私/授权：上下文由 MCP 客户端控制暴露范围（thisServer/allServers），服务端不持有模型密钥。

## 回归与测试
- `npm run build && npm test` 通过；e2e 覆盖 run 流程，渲染阶段做指针强校验。
- 可选扩展：新增集成测试模拟客户端支持 `includeContext` 的分支（需 MCP 客户端配合）。

## 快速修复摘要（已应用）
- Planner/Translator 的采样请求增加：
```ts
includeContext: "thisServer"
```

## 建议
- 若需要跨多服务器聚合上下文，再将策略提升到 `allServers` 并加入采样 token 预算保护。
