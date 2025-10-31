# MCP 最佳实践指南

完整的 Model Context Protocol (MCP) 服务器开发最佳实践文档，基于 MCP 2025-06-18 规范。

## 目录

1. [协议基础](#协议基础)
2. [工具定义](#工具定义)
3. [资源管理](#资源管理)
4. [提示模板](#提示模板)
5. [错误处理](#错误处理)
6. [安全性](#安全性)
7. [性能优化](#性能优化)
8. [测试和验证](#测试和验证)
9. [部署](#部署)
10. [常见问题](#常见问题)

---

## 协议基础

### 1.1 MCP 版本和规范

始终使用最新的 MCP 规范版本：

```json
{
  "mcpVersion": "2025-06-18",
  "name": "my-mcp-server",
  "version": "1.0.0"
}
```

**为什么重要**：
- 确保客户端兼容性
- 获得最新的功能和安全更新
- 支持新的协议特性

### 1.2 JSON-RPC 2.0 协议

MCP 使用 JSON-RPC 2.0 作为消息格式：

```typescript
// ✅ 正确的响应格式
{
  jsonrpc: "2.0",
  id: 1,
  result: {
    // 结果数据
  }
}

// ✅ 正确的错误格式
{
  jsonrpc: "2.0",
  id: 1,
  error: {
    code: -32600,
    message: "Invalid Request",
    data: { details: "..." }
  }
}
```

### 1.3 传输方式

**推荐：STDIO 传输**

```typescript
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server";

const transport = new StdioServerTransport();
```

**优点**：
- 最简单的部署
- 无需网络配置
- 最安全

**其他选项**：
- SSE (Server-Sent Events) - 用于 HTTP
- WebSocket - 用于双向通信

---

## 工具定义

### 2.1 JSON Schema 规范遵从

所有工具必须定义完整的 `inputSchema`，并严格遵守 JSON Schema 规范：

```typescript
// ✅ 正确的工具定义
{
  name: "my_tool",
  description: "清晰的工具描述",
  inputSchema: {
    type: "object",
    properties: {
      param1: {
        type: "string",
        description: "参数描述"
      },
      items_param: {
        type: "array",
        description: "数组参数",
        items: { type: "object" }  // ✅ 必须有 items
      }
    },
    required: ["param1"]
  }
}

// ❌ 错误的工具定义
{
  name: "bad_tool",
  inputSchema: {
    type: "object",
    properties: {
      items_param: {
        type: "array"
        // ❌ 缺少 items 定义 - 违反 JSON Schema spec
      }
    }
  }
}
```

### 2.2 数组类型处理

**关键规则**：所有 `type: "array"` 必须有 `items` 定义

```typescript
// ✅ 基础数组
{
  type: "array",
  items: { type: "string" }
}

// ✅ 对象数组
{
  type: "array",
  items: {
    type: "object",
    properties: {
      id: { type: "string" },
      value: { type: "number" }
    }
  }
}

// ✅ 嵌套数组
{
  type: "array",
  items: {
    type: "array",
    items: { type: "string" }
  }
}

// ❌ 不完整的数组定义
{
  type: "array"
  // 缺少 items
}
```

### 2.3 参数验证

在工具响应前进行参数验证：

```typescript
// ✅ 完整的验证流程
const handler = async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params;

  // 1. 参数存在性检查
  if (!args.goal) {
    return [{
      type: "text",
      text: "错误：goal 参数是必需的"
    }];
  }

  // 2. 参数类型检查
  if (typeof args.goal !== 'string') {
    return [{
      type: "text",
      text: "错误：goal 必须是字符串类型"
    }];
  }

  // 3. 参数范围检查
  if (args.limit && (args.limit < 1 || args.limit > 100)) {
    return [{
      type: "text",
      text: "错误：limit 必须在 1-100 之间"
    }];
  }

  // 4. 执行工具逻辑
  const result = await executeToolLogic(args);
  
  return [{
    type: "text",
    text: JSON.stringify(result)
  }];
};
```

### 2.4 工具响应格式

**返回值必须是 `Content[]` 类型**：

```typescript
// ✅ 正确的响应格式
return [
  {
    type: "text",
    text: "执行结果"
  }
];

// ✅ 包含多个内容类型
return [
  {
    type: "text",
    text: "执行结果"
  },
  {
    type: "text",
    text: "相关信息"
  }
];

// ❌ 直接返回对象（错误）
return { result: "..." }; // 错误！

// ❌ 返回字符串（错误）
return "result"; // 错误！
```

### 2.5 工具分类和组织

```typescript
// ✅ 按功能分组工具
const tools = [
  // 任务规划工具
  {
    name: "plan_task",
    description: "规划和分解任务"
  },
  // 执行工具
  {
    name: "compile_task",
    description: "编译任务"
  },
  {
    name: "run_task",
    description: "执行任务"
  },
  // 分析工具
  {
    name: "analyze_result",
    description: "分析结果"
  }
];
```

---

## 资源管理

### 3.1 资源定义

资源是 MCP 服务提供的静态或动态内容：

```typescript
// ✅ 完整的资源定义
{
  uri: "evidence://store/doc-123",
  name: "证据文档",
  description: "存储的证据卡片",
  mimeType: "application/json"
}

// ✅ 资源 URI 格式
// scheme://authority/path
// - scheme: 自定义资源类型（evidence, artifact, log 等）
// - authority: 资源类别（store, session 等）
// - path: 资源标识符
```

### 3.2 资源列表实现

```typescript
// ✅ 实现 resources/list 方法
server.setRequestHandler(
  ListResourcesRequestSchema,
  async () => {
    return {
      resources: [
        {
          uri: "evidence://store/all",
          name: "所有证据",
          description: "MCP 证据存储",
          mimeType: "application/json"
        },
        {
          uri: "artifact://store/all",
          name: "所有工件",
          description: "执行工件",
          mimeType: "application/json"
        },
        {
          uri: "log://session/current",
          name: "当前会话日志",
          description: "会话执行日志",
          mimeType: "text/plain"
        }
      ]
    };
  }
);
```

### 3.3 资源读取实现

```typescript
// ✅ 实现 resources/read 方法
server.setRequestHandler(
  ReadResourceRequestSchema,
  async (request) => {
    const uri = request.params.uri;
    
    if (uri === "evidence://store/all") {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify(evidenceStore.getAll())
          }
        ]
      };
    }
    
    throw new Error(`Unknown resource: ${uri}`);
  }
);
```

---

## 提示模板

### 4.1 提示定义

提示是预定义的 AI 指令模板：

```typescript
// ✅ 完整的提示定义
{
  name: "planner_system",
  description: "任务规划系统提示",
  arguments: [
    {
      name: "objective",
      description: "规划目标",
      required: true
    },
    {
      name: "context",
      description: "上下文信息",
      required: false
    }
  ]
}
```

### 4.2 提示列表实现

```typescript
// ✅ 实现 prompts/list 方法
server.setRequestHandler(
  ListPromptsRequestSchema,
  async () => {
    return {
      prompts: [
        {
          name: "planner_system",
          description: "任务规划系统提示",
          arguments: [
            {
              name: "objective",
              description: "规划目标",
              required: true
            }
          ]
        },
        {
          name: "reflector_criteria",
          description: "反思分析提示",
          arguments: [
            {
              name: "result",
              description: "执行结果",
              required: true
            }
          ]
        }
      ]
    };
  }
);
```

### 4.3 提示获取和变量替换

```typescript
// ✅ 实现 prompts/get 方法
server.setRequestHandler(
  GetPromptRequestSchema,
  async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "planner_system") {
      const template = loadPromptTemplate("planner_system");
      
      // 变量替换
      const content = template
        .replace("{objective}", args?.objective || "")
        .replace("{context}", args?.context || "");

      return {
        messages: [
          {
            role: "user",
            content
          }
        ]
      };
    }

    throw new Error(`Unknown prompt: ${name}`);
  }
);
```

---

## 错误处理

### 5.1 标准错误响应

```typescript
// ✅ JSON-RPC 错误代码
const errors = {
  PARSE_ERROR: -32700,              // 解析错误
  INVALID_REQUEST: -32600,          // 无效请求
  METHOD_NOT_FOUND: -32601,         // 方法不存在
  INVALID_PARAMS: -32602,           // 无效参数
  INTERNAL_ERROR: -32603,           // 内部错误
  SERVER_ERROR: -32000,             // 服务器错误
  NOT_FOUND: -32000,                // 资源不存在
  INVALID_STATE: -32001             // 无效状态
};

// ✅ 错误响应格式
{
  jsonrpc: "2.0",
  id: 1,
  error: {
    code: -32602,
    message: "Invalid parameters",
    data: {
      details: "Parameter 'goal' is required"
    }
  }
}
```

### 5.2 工具中的错误处理

```typescript
// ✅ 完整的错误处理
const handler = async (request: CallToolRequest) => {
  try {
    const { name, arguments: args } = request.params;

    // 参数验证
    if (!args.required_param) {
      throw new Error("Missing required parameter: required_param");
    }

    // 执行工具逻辑
    const result = await performToolLogic(args);

    // 返回成功结果
    return [{
      type: "text",
      text: JSON.stringify(result)
    }];

  } catch (error) {
    // 返回错误信息
    return [{
      type: "text",
      text: `Error: ${error.message}`
    }];
  }
};
```

---

## 安全性

### 6.1 输入验证

```typescript
// ✅ 严格的输入验证
const validateToolInput = (name: string, args: any): boolean => {
  // 1. 检查参数存在
  if (!args) return false;

  // 2. 类型检查
  if (name === "plan_task") {
    if (typeof args.goal !== 'string') return false;
    if (args.goal.length > 1000) return false; // 长度限制
    if (args.context && typeof args.context !== 'string') return false;
  }

  // 3. 防止注入攻击
  if (containsSuspiciousPatterns(args)) return false;

  return true;
};

// ✅ 防止注入的辅助函数
const containsSuspiciousPatterns = (obj: any): boolean => {
  const json = JSON.stringify(obj);
  const suspiciousPatterns = [
    /<script/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /eval\(/gi
  ];
  return suspiciousPatterns.some(p => p.test(json));
};
```

### 6.2 速率限制

```typescript
// ✅ 实现速率限制
class RateLimiter {
  private requests = new Map<string, number[]>();
  
  isAllowed(clientId: string, maxRequests: number = 100, windowMs: number = 60000): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(clientId) || [];
    
    // 移除过期的请求记录
    const recentRequests = timestamps.filter(t => now - t < windowMs);
    
    if (recentRequests.length >= maxRequests) {
      return false;
    }
    
    recentRequests.push(now);
    this.requests.set(clientId, recentRequests);
    return true;
  }
}
```

### 6.3 超时管理

```typescript
// ✅ 实现超时控制
const executeWithTimeout = async (
  fn: () => Promise<any>,
  timeoutMs: number = 30000
): Promise<any> => {
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Execution timeout')), timeoutMs)
  );

  return Promise.race([fn(), timeoutPromise]);
};

// 在工具处理中使用
const result = await executeWithTimeout(
  () => performToolLogic(args),
  30000 // 30 秒超时
);
```

---

## 性能优化

### 7.1 缓存策略

```typescript
// ✅ 实现缓存
class Cache<T> {
  private cache = new Map<string, { value: T; expiry: number }>();
  private defaultTTL = 300000; // 5 分钟

  set(key: string, value: T, ttlMs: number = this.defaultTTL): void {
    this.cache.set(key, {
      value,
      expiry: Date.now() + ttlMs
    });
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  clear(): void {
    this.cache.clear();
  }
}
```

### 7.2 流式响应

```typescript
// ✅ 用于大型数据的流式传输
const streamLargeResponse = async (data: any[], chunkSize: number = 100) => {
  const chunks = [];
  
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push({
      type: "text",
      text: JSON.stringify(data.slice(i, i + chunkSize))
    });
  }
  
  return chunks;
};
```

### 7.3 异步处理

```typescript
// ✅ 使用异步处理避免阻塞
const handler = async (request: CallToolRequest) => {
  const { name, arguments: args } = request.params;

  // 异步执行，避免阻塞
  const result = await Promise.all([
    fetchData(args.param1),
    processData(args.param2),
    analyzeData(args.param3)
  ]);

  return [{
    type: "text",
    text: JSON.stringify(result)
  }];
};
```

---

## 测试和验证

### 8.1 Schema 验证

```typescript
// ✅ JSON Schema 验证脚本
const validateToolSchema = (tool: Tool): string[] => {
  const errors: string[] = [];
  const schema = tool.inputSchema;

  // 检查 schema 类型
  if (schema.type !== 'object') {
    errors.push(`Tool ${tool.name}: schema type must be 'object'`);
  }

  // 递归检查所有数组类型
  const checkArrays = (obj: any, path: string) => {
    if (obj && typeof obj === 'object') {
      if (obj.type === 'array' && !obj.items) {
        errors.push(`Tool ${tool.name}: array at ${path} missing 'items' definition`);
      }
      for (const key in obj) {
        checkArrays(obj[key], `${path}.${key}`);
      }
    }
  };

  checkArrays(schema, 'inputSchema');
  return errors;
};

// 使用示例
const validationErrors = toolDefinitions.flatMap(validateToolSchema);
if (validationErrors.length > 0) {
  console.error('Schema errors:', validationErrors);
  process.exit(1);
}
```

### 8.2 集成测试

```typescript
// ✅ MCP 服务集成测试
describe('MCP Server', () => {
  let server: MCPServer;

  beforeEach(() => {
    server = new MCPServer();
  });

  test('tools/list should return valid tools', async () => {
    const response = await server.handleRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {}
    });

    expect(response.result.tools).toHaveLength(6);
    expect(response.result.tools[0]).toHaveProperty('name');
    expect(response.result.tools[0]).toHaveProperty('inputSchema');
  });

  test('tools/call should validate parameters', async () => {
    const response = await server.handleRequest({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "plan_task",
        arguments: { goal: "" } // 缺少 goal
      }
    });

    expect(response.error).toBeDefined();
  });

  test('all array types must have items definition', async () => {
    const response = await server.handleRequest({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/list",
      params: {}
    });

    const hasArrayWithoutItems = response.result.tools.some((tool: any) => {
      const checkArrays = (obj: any): boolean => {
        if (obj && typeof obj === 'object') {
          if (obj.type === 'array' && !obj.items) return true;
          for (const key in obj) {
            if (checkArrays(obj[key])) return true;
          }
        }
        return false;
      };
      return checkArrays(tool.inputSchema);
    });

    expect(hasArrayWithoutItems).toBe(false);
  });
});
```

### 8.3 性能测试

```typescript
// ✅ 性能基准测试
const performanceTest = async () => {
  const iterations = 1000;
  const start = Date.now();

  for (let i = 0; i < iterations; i++) {
    await server.handleRequest({
      jsonrpc: "2.0",
      id: i,
      method: "tools/list",
      params: {}
    });
  }

  const duration = Date.now() - start;
  const avgTime = duration / iterations;

  console.log(`Processed ${iterations} requests in ${duration}ms`);
  console.log(`Average time: ${avgTime.toFixed(2)}ms per request`);

  if (avgTime > 10) {
    console.warn('⚠️  Performance may need optimization');
  }
};
```

---

## 部署

### 9.1 生产环境配置

```typescript
// ✅ 生产环境 package.json
{
  "name": "@myorg/mcp-server",
  "version": "1.0.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "mcp-server": "dist/index.js"
  },
  "scripts": {
    "build": "tsc -p .",
    "start": "node dist/index.js",
    "dev": "tsc -w -p ."
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.20.2"
  },
  "devDependencies": {
    "typescript": "^5.6.3",
    "@types/node": "^22.0.0"
  }
}
```

### 9.2 Docker 部署

```dockerfile
# ✅ Dockerfile for MCP Server
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

ENTRYPOINT ["node", "dist/index.js"]
```

### 9.3 VS Code 集成配置

```json
{
  "mcpServers": {
    "my-mcp-server": {
      "command": "node",
      "args": ["/path/to/server/dist/index.js"],
      "env": {
        "NODE_ENV": "production",
        "LOG_LEVEL": "info"
      }
    }
  }
}
```

---

## 常见问题

### Q1: "Error: tool parameters array type must have items"

**问题**：工具定义中数组类型缺少 `items` 字段

**解决方案**：
```typescript
// ❌ 错误
subtasks: {
  type: "array"
}

// ✅ 正确
subtasks: {
  type: "array",
  items: { type: "object" }
}
```

### Q2: 工具在列表中出现但无法调用

**问题**：工具响应格式不正确

**解决方案**：
```typescript
// ❌ 错误
return { result: "..." };

// ✅ 正确
return [{
  type: "text",
  text: "..."
}];
```

### Q3: VS Code 无法连接到 MCP 服务器

**问题**：
- 服务器未正确实现 `initialize` 方法
- 日志输出污染了 STDIO
- 传输配置错误

**解决方案**：
```typescript
// ✅ 正确的初始化
server.setRequestHandler(
  InitializeRequestSchema,
  async (request) => {
    return {
      protocolVersion: "2025-06-18",
      capabilities: {
        tools: {},
        resources: {},
        prompts: {}
      },
      serverInfo: {
        name: "my-server",
        version: "1.0.0"
      }
    };
  }
);

// 避免日志输出到 STDIO
// ❌ 错误
console.log("Server started");

// ✅ 正确
process.stderr.write("[Server] Started\n");
```

### Q4: 如何实现自定义错误消息

**解决方案**：
```typescript
// ✅ 标准错误响应
return [{
  type: "text",
  text: `Error: Invalid input. Expected string, got ${typeof value}`
}];

// ✅ JSON 格式错误
return [{
  type: "text",
  text: JSON.stringify({
    error: true,
    code: "INVALID_INPUT",
    message: "Invalid parameter",
    details: { field: "goal", expected: "string" }
  })
}];
```

### Q5: 如何调试 MCP 服务器

**方法 1：使用 MCP Inspector**
```bash
npx @modelcontextprotocol/inspector --cli node dist/server.js --method tools/list
```

**方法 2：日志记录**
```typescript
// ✅ 安全的日志输出
const log = (message: string, data?: any) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    message,
    data
  };
  process.stderr.write(JSON.stringify(logEntry) + '\n');
};
```

### Q6: 如何处理大型响应

**解决方案**：分块返回
```typescript
// ✅ 大型数据分块
const largeData = await fetchLargeDataset();
const chunks = [];

for (let i = 0; i < largeData.length; i += 100) {
  chunks.push({
    type: "text",
    text: JSON.stringify({
      chunk: Math.floor(i / 100),
      data: largeData.slice(i, i + 100)
    })
  });
}

return chunks;
```

---

## 总结

### MCP 开发的核心原则

1. **规范遵从**：严格遵循 MCP 2025-06-18 规范
2. **JSON Schema 验证**：所有数组必须有 `items` 定义
3. **错误处理**：正确的 JSON-RPC 错误响应
4. **安全性**：输入验证、速率限制、超时管理
5. **性能**：缓存、异步处理、流式传输
6. **测试**：单元测试、集成测试、性能测试
7. **部署**：Docker、VS Code 配置、监控

### 检查清单

在部署前检查：

- ✅ 所有工具都有完整的 `inputSchema`
- ✅ 所有数组类型都有 `items` 定义
- ✅ 所有工具响应都是 `Content[]` 格式
- ✅ 实现了所有必需的 MCP 方法
- ✅ 错误处理符合 JSON-RPC 2.0 规范
- ✅ 通过了编译和测试
- ✅ 日志不会污染 STDIO
- ✅ 环境变量正确配置
- ✅ 文档完整且最新

---

**文档版本**: 1.0  
**MCP 规范版本**: 2025-06-18  
**最后更新**: 2025-10-31  
**维护者**: IsoMaestro 团队
