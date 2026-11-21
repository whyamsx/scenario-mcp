#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ScenarioAPI } from './api.js';
import { createServer } from './server.js';

try {
  const { values } = parseArgs({ options: { url: { type: 'string' }, help: { type: 'boolean', short: 'h' }, version: { type: 'boolean' } } });
  if (values.help || values.version) {
    console.log(values.version ? '0.1.0' : 'scenario-mcp --url https://scenario.whyamsx.com\nSet SCENARIO_TOKEN in your MCP client configuration. Requires Node.js 22+.');
  } else {
    const server = createServer(new ScenarioAPI(values.url || process.env.SCENARIO_URL || 'https://scenario.whyamsx.com', process.env.SCENARIO_TOKEN));
    await server.connect(new StdioServerTransport());
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await server.close(); process.exit(0); });
  }
} catch (error) {
  // Never print configuration, environment, HTTP headers or tokens.
  console.error(error instanceof Error ? error.message : 'MCP startup failed.'); process.exitCode = 1;
}
