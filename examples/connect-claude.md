1) Build server: `npm install && npm run build`
2) Start MCP server (stdio): `npm run mcp`
3) In your MCP-compatible client, add a custom server:
   - Command: node
   - Args: dist/server.js
   - Transport: stdio
4) List tools/resources/prompts via client's MCP inspector.
