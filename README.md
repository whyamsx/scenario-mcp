# Scenario MCP

Connect your AI agent to [Scenario](https://scenario.whyamsx.com).

1. Install [Node.js 22+](https://nodejs.org/en/download).
2. Create a token in your Scenario account.
3. Add this to your agent's MCP settings:

```json
{
  "mcpServers": {
    "scenario": {
      "command": "npx",
      "args": ["--yes", "--package", "https://github.com/whyamsx/scenario-mcp/archive/refs/tags/v0.2.0.tar.gz", "scenario-mcp"],
      "env": { "SCENARIO_TOKEN": "YOUR_TOKEN" }
    }
  }
}
```

On Windows, use `npx.cmd`. Restart the MCP connection. Keep your token private.

Ask your agent: “Read the checkout flow in my code and create a Scenario with its steps, conditions and returns. Mark unknowns; don't guess.”

The agent can list, read, create, update and validate your scenarios. Proposed edits appear in the editor for your approval.

This public package connects locally over stdio to the MCP service at `https://scenario-mcp.whyamsx.com/mcp`. The service is deployed with Scenario. For another server, add `--url https://your-mcp-domain` to `args`.
