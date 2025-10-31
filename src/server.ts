import { registerAll } from "./index.js";

type JsonRpc = { id?: number|string; method?: string; params?: any; result?: any; error?: any; };

const state = registerAll();

process.stdin.setEncoding("utf8");
let buf = "";
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line) as JsonRpc;
      handleMessage(msg);
    } catch (e) {
      write({ error: { code: -32700, message: "Parse error" } });
    }
  }
});

function write(msg: JsonRpc) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

async function handleMessage(msg: JsonRpc) {
  try {
    const { id, method, params } = msg;
    if (!method) return write({ id, error: { code: -32600, message: "Invalid request" } });

    // 简化路由：mcp.<domain>.<name>
    if (method === "mcp.tools.list") {
      return write({ id, result: Object.keys(state.tools) });
    }
    if (method === "mcp.tools.call") {
      const { name, args } = params || {};
      if (!state.tools[name]) return write({ id, error: { code: -32601, message: "No such tool" } });
      const out = await state.tools[name](args ?? {});
      return write({ id, result: out });
    }
    if (method === "mcp.resources.list") {
      return write({ id, result: Object.keys(state.resources) });
    }
    if (method === "mcp.resources.read") {
      const { uri, path } = params || {};
      if (!state.resources[uri]) return write({ id, error: { code: -32601, message: "No such resource" } });
      const out = await state.resources[uri](path ?? "");
      return write({ id, result: out });
    }
    if (method === "mcp.prompts.list") {
      return write({ id, result: Object.keys(state.prompts) });
    }
    if (method === "mcp.prompts.get") {
      const { name } = params || {};
      if (!state.prompts[name]) return write({ id, error: { code: -32601, message: "No such prompt" } });
      return write({ id, result: state.prompts[name] });
    }

    return write({ id, error: { code: -32601, message: "Unknown method" } });
  } catch (e: any) {
    return write({ id: msg.id, error: { code: -32000, message: e?.message || "Server error" } });
  }
}
