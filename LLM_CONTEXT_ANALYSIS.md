# IsoMaestro LLM 采样上下文分析报告

## 执行摘要

本报告详细分析了 IsoMaestro 项目中 LLM 采样功能是否包含上下文。基于对代码库和 MCP 官方文档的深入研究，**结论是：IsoMaestro 当前实现支持上下文传递，但未实际使用该功能**。

---

## 1. 核心发现

### 1.1 `includeContext` 参数支持

**代码位置**: `/home/codex/IsoMaestro/src/runtime/sampling.ts`

```typescript
export interface SamplingRequest {
  description?: string;
  systemPrompt?: string;
  messages: SamplingMessage[];
  maxTokens: number;
  temperature?: number;
  stopSequences?: string[];
  includeContext?: "none" | "thisServer" | "allServers";  // ✅ 已定义
  metadata?: Record<string, unknown>;
  modelPreferences?: {
    hints?: Array<{ name?: string }>;
    costPriority?: number;
    speedPriority?: number;
    intelligencePriority?: number;
  };
}
```

**关键发现**:
- ✅ **接口定义完整**: `SamplingRequest` 接口包含 `includeContext` 参数
- ✅ **类型定义正确**: 支持三种模式 - `"none"`, `"thisServer"`, `"allServers"`
- ✅ **传递到 SDK**: 在 `trySampleMessage` 函数中正确传递给 MCP SDK

```typescript
export async function trySampleMessage(request: SamplingRequest): Promise<CreateMessageResult | null> {
  // ...
  const result = await serverInstance!.createMessage({
    systemPrompt: request.systemPrompt,
    messages: request.messages,
    maxTokens: request.maxTokens,
    temperature: request.temperature,
    stopSequences: request.stopSequences,
    includeContext: request.includeContext,  // ✅ 正确传递
    metadata: request.metadata,
    modelPreferences: request.modelPreferences
  } as any, { timeout: SAMPLING_TIMEOUT_MS });
  // ...
}
```

---

## 2. 实际使用情况分析

### 2.1 Planner Agent (规划器)

**代码位置**: `/home/codex/IsoMaestro/src/agents/planner.ts`

```typescript
async function plannerWithSampling(goal: string, context?: string): Promise<TaskContractT | null> {
  // ...
  for (const [index, attempt] of attempts.entries()) {
    const request = {
      description: `planner_attempt_${index + 1}`,
      systemPrompt: `${systemText}\nRespond with valid JSON only...`,
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: serialized,
          }
        }
      ],
      maxTokens: attempt.maxTokens,
      temperature: attempt.temperature,
      modelPreferences: {
        intelligencePriority: 0.9
      }
      // ❌ 未设置 includeContext 参数
    };
    const response = await trySampleMessage(request);
    // ...
  }
}
```

**分析结果**:
- ❌ **未使用 includeContext**: Planner 在调用 `trySampleMessage` 时没有传递 `includeContext` 参数
- 📊 **默认行为**: 由于参数可选，SDK 将使用默认值（通常是 `"none"`）
- 💡 **改进空间**: 可以设置为 `"thisServer"` 以利用当前 MCP 服务器的上下文

### 2.2 Translator Agent (编译器)

**代码位置**: `/home/codex/IsoMaestro/src/agents/translator.ts`

```typescript
async function translatorWithSampling(contract: TaskContractT, base: ExecutionCapsuleT): Promise<ExecutionCapsuleT | null> {
  // ...
  for (const [index, attempt] of attempts.entries()) {
    const request = {
      description: `translator_attempt_${index + 1}`,
      systemPrompt: `${systemText}\nRespond with valid JSON only...`,
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text: payload
          }
        }
      ],
      maxTokens: attempt.maxTokens,
      temperature: attempt.temperature,
      modelPreferences: {
        intelligencePriority: 0.9
      }
      // ❌ 未设置 includeContext 参数
    };

    const result = await trySampleMessage(request);
    // ...
  }
}
```

**分析结果**:
- ❌ **同样未使用**: Translator 也没有传递 `includeContext`
- 🔄 **处理复杂任务**: Translator 编译执行计划，理论上能从上下文中获益
- 📈 **潜在收益**: 添加 `includeContext: "thisServer"` 可以让 LLM 访问工具定义、资源等

---

## 3. MCP 规范中的 `includeContext` 详解

### 3.1 官方定义

根据 MCP 官方规范 (2025-06-18):

```typescript
interface CreateMessageRequest {
  method: "sampling/createMessage";
  params: {
    includeContext?: "none" | "thisServer" | "allServers";
    // ... 其他参数
  };
}
```

**文档说明**:
> "A request to include context from one or more MCP servers (including the caller), to be attached to the prompt. The client MAY ignore this request."

### 3.2 三种模式详解

| 模式 | 含义 | 包含的上下文内容 | 适用场景 |
|------|------|------------------|----------|
| `"none"` | 不包含任何上下文 | 无 | 独立任务、不需要服务器信息 |
| `"thisServer"` | 仅包含当前服务器上下文 | - 当前 MCP 服务器的工具定义<br>- 资源列表<br>- 提示模板<br>- 服务器元数据 | **推荐用于 IsoMaestro** |
| `"allServers"` | 包含所有连接的服务器上下文 | 客户端连接的所有 MCP 服务器的信息 | 多服务器协作场景 |

### 3.3 上下文内容示例

当 `includeContext: "thisServer"` 时，LLM 可能接收到的上下文：

```json
{
  "server": {
    "name": "IsoMaestro",
    "version": "1.0.0",
    "tools": [
      {
        "name": "retrieve_evidence",
        "description": "Retrieve evidence cards from RAG store",
        "inputSchema": { "query": "string", "topK": "number", "filters": "object" }
      },
      {
        "name": "render_with_pointers",
        "description": "Render content with pointer validation",
        "inputSchema": { "draft": "string" }
      },
      {
        "name": "plan_task",
        "description": "Decompose user goal into subtasks",
        "inputSchema": { "goal": "string", "context": "string?" }
      }
      // ... 其他工具
    ],
    "resources": [
      // 可用的资源列表
    ],
    "prompts": [
      // 提示模板列表
    ]
  }
}
```

---

## 4. 对 IsoMaestro 的影响分析

### 4.1 当前状态

| 组件 | 支持上下文传递 | 实际使用 | 影响 |
|------|----------------|----------|------|
| **sampling.ts** | ✅ 是 | N/A | 基础设施就绪 |
| **Planner** | ✅ 是 | ❌ 否 | 规划可能不够精准 |
| **Translator** | ✅ 是 | ❌ 否 | 编译可能不够智能 |
| **Reflector** | ⚠️ 未检查 | ⚠️ 未检查 | 需进一步分析 |

### 4.2 潜在问题

1. **规划器不知道可用工具**
   - 当前：LLM 仅凭 `systemPrompt` 和用户目标生成计划
   - 问题：可能生成调用不存在工具的计划
   - 解决：添加 `includeContext: "thisServer"` 让 LLM 知道可用工具

2. **编译器缺乏工具参数信息**
   - 当前：Translator 凭经验生成 `stepPlan`
   - 问题：可能生成无效的工具参数
   - 解决：通过上下文获取精确的工具 schema

3. **无法利用 MCP 生态**
   - 当前：每次采样都是"盲盒"
   - 问题：无法与其他 MCP 服务器协作
   - 解决：在多服务器场景下使用 `"allServers"`

---

## 5. 改进建议

### 5.1 立即改进（高优先级）

**为 Planner 添加上下文**:

```typescript
// src/agents/planner.ts
async function plannerWithSampling(goal: string, context?: string): Promise<TaskContractT | null> {
  // ...
  const request = {
    description: `planner_attempt_${index + 1}`,
    systemPrompt: `${systemText}\n...`,
    messages: [...],
    maxTokens: attempt.maxTokens,
    temperature: attempt.temperature,
    includeContext: "thisServer",  // ✅ 添加此行
    modelPreferences: {
      intelligencePriority: 0.9
    }
  };
  // ...
}
```

**为 Translator 添加上下文**:

```typescript
// src/agents/translator.ts
async function translatorWithSampling(contract: TaskContractT, base: ExecutionCapsuleT): Promise<ExecutionCapsuleT | null> {
  // ...
  const request = {
    description: `translator_attempt_${index + 1}`,
    systemPrompt: `${systemText}\n...`,
    messages: [...],
    maxTokens: attempt.maxTokens,
    temperature: attempt.temperature,
    includeContext: "thisServer",  // ✅ 添加此行
    modelPreferences: {
      intelligencePriority: 0.9
    }
  };
  // ...
}
```

### 5.2 中期改进（中优先级）

1. **环境变量控制**:
   ```typescript
   // src/config/env.ts
   export const config = {
     // ...
     samplingIncludeContext: process.env.SAMPLING_INCLUDE_CONTEXT as 
       "none" | "thisServer" | "allServers" || "thisServer"
   };
   ```

2. **动态上下文选择**:
   ```typescript
   // 根据任务复杂度动态选择
   function getContextMode(complexity: "simple" | "medium" | "complex"): string {
     switch (complexity) {
       case "simple": return "none";
       case "medium": return "thisServer";
       case "complex": return "allServers";
     }
   }
   ```

### 5.3 长期改进（低优先级）

1. **上下文缓存**:
   - 缓存服务器上下文，避免每次请求重新构建
   - 监听工具/资源变化，失效缓存

2. **上下文过滤**:
   - 根据任务类型筛选相关工具
   - 减少无关信息，降低 token 消耗

3. **监控和度量**:
   - 记录有无上下文的采样效果对比
   - 分析 token 消耗 vs 质量提升

---

## 6. 客户端行为注意事项

### 6.1 客户端可选实现

**重要**: MCP 规范明确指出：

> "The client MAY ignore this request."

这意味着：
- 即使服务器请求 `includeContext: "thisServer"`，客户端可以选择不包含
- 不同的 MCP 客户端（Claude Desktop、VS Code Copilot、自定义客户端）行为可能不同
- 应该在文档中说明需要客户端支持上下文功能

### 6.2 兼容性策略

```typescript
// 应对客户端不支持上下文的情况
async function robustPlanning(goal: string): Promise<TaskContractT> {
  const sampled = await plannerWithSampling(goal);
  
  if (!sampled) {
    // 降级到规则引擎
    logger.info({ msg: "planner_fallback_to_rules" });
    return ruleBasedPlanner(goal);
  }
  
  // 验证生成的计划是否使用了有效工具
  const validTools = await getAvailableTools();
  const isValid = validatePlanTools(sampled, validTools);
  
  if (!isValid) {
    logger.warn({ msg: "planner_invalid_tools", plan: sampled });
    return ruleBasedPlanner(goal);  // 再次降级
  }
  
  return sampled;
}
```

---

## 7. 测试建议

### 7.1 功能测试

创建测试文件 `test-context-sampling.js`:

```javascript
import { planner } from './src/agents/planner.js';
import { translator } from './src/agents/translator.js';

async function testContextSampling() {
  console.log('Testing Planner with context...');
  
  // 测试 1: 简单任务
  const plan1 = await planner("Summarize recent research on AI safety");
  console.log('Plan 1 (simple):', JSON.stringify(plan1, null, 2));
  
  // 测试 2: 需要工具知识的任务
  const plan2 = await planner("Retrieve evidence about quantum computing and render a comparison report");
  console.log('Plan 2 (tool-aware):', JSON.stringify(plan2, null, 2));
  
  // 测试 3: 验证 Translator
  const capsule = await translator(plan2);
  console.log('Capsule:', JSON.stringify(capsule, null, 2));
  
  // 验证生成的计划是否引用了实际存在的工具
  const usedTools = new Set(capsule.stepPlan.map(s => s.tool).filter(Boolean));
  const allowedTools = new Set(capsule.envSpec.toolsAllowlist);
  
  const invalidTools = [...usedTools].filter(t => !allowedTools.has(t));
  if (invalidTools.length > 0) {
    console.error('❌ Invalid tools found:', invalidTools);
  } else {
    console.log('✅ All tools are valid');
  }
}

testContextSampling().catch(console.error);
```

### 7.2 对比测试

对比有无上下文的效果：

```javascript
async function compareWithAndWithoutContext() {
  const goal = "Create a workflow to analyze code quality metrics";
  
  // 禁用上下文
  const planWithout = await plannerWithoutContext(goal);
  
  // 启用上下文
  const planWith = await plannerWithContext(goal);
  
  console.log('Without context:', {
    subtasksCount: planWithout.subtasks.length,
    tools: planWithout.toolsAllowlist
  });
  
  console.log('With context:', {
    subtasksCount: planWith.subtasks.length,
    tools: planWith.toolsAllowlist
  });
}
```

---

## 8. 性能考虑

### 8.1 Token 消耗

| 场景 | includeContext | 预估额外 Token | 成本影响 |
|------|----------------|----------------|----------|
| **简单任务** | `"none"` | 0 | 基准 |
| **中等任务** | `"thisServer"` | 200-500 | +10-20% |
| **复杂任务** | `"allServers"` | 500-2000 | +20-50% |

### 8.2 优化策略

1. **智能选择模式**:
   - 分析用户目标关键词
   - 简单查询使用 `"none"`
   - 涉及工具调用使用 `"thisServer"`

2. **上下文压缩**:
   - 只包含相关工具的 schema
   - 省略不必要的元数据

3. **缓存上下文**:
   ```typescript
   let cachedContext: string | null = null;
   let contextVersion = 0;
   
   function getServerContext(): string {
     if (cachedContext && !hasContextChanged(contextVersion)) {
       return cachedContext;
     }
     // 重新构建上下文
     cachedContext = buildContext();
     contextVersion++;
     return cachedContext;
   }
   ```

---

## 9. 总结与行动项

### 9.1 核心结论

| 问题 | 答案 | 证据 |
|------|------|------|
| **IsoMaestro 是否支持上下文传递？** | ✅ 是 | `sampling.ts` 定义了 `includeContext` 并传递给 SDK |
| **当前是否使用上下文功能？** | ❌ 否 | Planner 和 Translator 均未设置该参数 |
| **不使用上下文有何影响？** | ⚠️ 中等 | LLM 不知道可用工具，可能生成无效计划 |
| **客户端一定会包含上下文吗？** | ❌ 否 | MCP 规范允许客户端忽略请求 |

### 9.2 行动项

#### 高优先级 (立即执行)
- [ ] 为 `plannerWithSampling` 添加 `includeContext: "thisServer"`
- [ ] 为 `translatorWithSampling` 添加 `includeContext: "thisServer"`
- [ ] 测试改动后的效果

#### 中优先级 (1-2 周内)
- [ ] 添加环境变量 `SAMPLING_INCLUDE_CONTEXT`
- [ ] 实现上下文模式的动态选择逻辑
- [ ] 编写对比测试

#### 低优先级 (长期)
- [ ] 实现上下文缓存机制
- [ ] 添加上下文过滤功能
- [ ] 建立 token 消耗监控

---

## 10. 参考文档

### 10.1 MCP 官方文档
- [MCP Specification - Sampling](https://spec.modelcontextprotocol.io/specification/2025-06-18/client/sampling)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [CreateMessageRequest Interface](https://spec.modelcontextprotocol.io/specification/2025-06-18/schema#createmessagerequest)

### 10.2 相关代码文件
- `/home/codex/IsoMaestro/src/runtime/sampling.ts` - 采样基础设施
- `/home/codex/IsoMaestro/src/agents/planner.ts` - 规划器实现
- `/home/codex/IsoMaestro/src/agents/translator.ts` - 编译器实现
- `/home/codex/IsoMaestro/src/config/env.ts` - 环境配置

### 10.3 关键引用

**MCP 规范关于 includeContext 的说明**:
> "A request to include context from one or more MCP servers (including the caller), to be attached to the prompt. The client MAY ignore this request. Possible values: 'none', 'thisServer', 'allServers'."

**Token 优化建议**:
> "The client MAY choose to sample fewer tokens than the requested maximum."

---

## 附录 A: 快速修复 Patch

```bash
# 应用此 patch 快速启用上下文支持
cat << 'EOF' > enable-context.patch
diff --git a/src/agents/planner.ts b/src/agents/planner.ts
index xxx..yyy 100644
--- a/src/agents/planner.ts
+++ b/src/agents/planner.ts
@@ -20,6 +20,7 @@ async function plannerWithSampling(goal: string, context?: string): Promise<Tas
       maxTokens: attempt.maxTokens,
       temperature: attempt.temperature,
+      includeContext: "thisServer",
       modelPreferences: {
         intelligencePriority: 0.9
       }

diff --git a/src/agents/translator.ts b/src/agents/translator.ts
index xxx..yyy 100644
--- a/src/agents/translator.ts
+++ b/src/agents/translator.ts
@@ -115,6 +115,7 @@ async function translatorWithSampling(contract: TaskContractT, base: ExecutionC
       maxTokens: attempt.maxTokens,
       temperature: attempt.temperature,
+      includeContext: "thisServer",
       modelPreferences: {
         intelligencePriority: 0.9
       }
EOF

git apply enable-context.patch
```

---

**报告生成时间**: 2025-11-01  
**分析工具**: Context7 MCP Documentation Retrieval  
**分析范围**: IsoMaestro 代码库 + MCP 官方规范 v2025-06-18
