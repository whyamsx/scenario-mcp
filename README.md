# Scenario MCP (retired)

This package is no longer needed. The [Scenario](https://scenario.whyamsx.com) MCP server runs in the cloud, and agents connect to it by URL. There is nothing to install or update.

Any agent that adds MCP servers by URL (Streamable HTTP) needs two values:

- URL: `https://scenario-mcp.whyamsx.com/mcp`
- Header: `Authorization: Bearer YOUR_TOKEN`

Claude Code:

```sh
claude mcp add --transport http --scope user scenario https://scenario-mcp.whyamsx.com/mcp --header "Authorization: Bearer YOUR_TOKEN"
```

Create a token in your Scenario account. Under the new token, choose your agent and copy its settings with the token filled in. Settings for Claude, Cursor, VS Code, Codex and Gemini CLI are in the [connection guide](https://scenario.whyamsx.com/docs/mcp).

If your agent still starts `scenario-mcp` with `npx`, replace that configuration with the connection above and keep your token.
