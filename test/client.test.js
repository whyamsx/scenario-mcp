import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
const cli = fileURLToPath(new URL('../src/cli.js', import.meta.url));
const token = 'sst_test_only';
test('refuses insecure URLs and invalid credentials without exposing secrets', () => {
  for (const url of ['http://example.com', 'https://user:secret@example.com', 'https://example.com/?secret=secret', 'https://example.com/other']) {
    const result = spawnSync(process.execPath, [cli, '--url', url], { env: { ...process.env, SCENARIO_TOKEN: token }, encoding: 'utf8' });
    assert.notEqual(result.status, 0); assert.equal(result.stdout, ''); assert.ok(!result.stderr.includes('secret')); assert.ok(!result.stderr.includes(token));
  }
});
test('local stdio forwards remote tools and results without a local tool catalog', async t => {
  const server = http.createServer(async (req, res) => {
    assert.equal(req.url, '/mcp'); assert.equal(req.headers.authorization, 'Bearer ' + token);
    const mcp = new McpServer({ name: 'remote-scenario', version: 'test' });
    mcp.registerTool('remote_only_tool', { description: 'Published by the service', inputSchema: {} }, async () => ({ content: [{ type: 'text', text: 'remote result' }], structuredContent: { review: { status: 'pending' } } }));
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { void transport.close(); void mcp.close(); });
    await mcp.connect(transport); await transport.handleRequest(req, res);
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const transport = new StdioClientTransport({ command: process.execPath, args: [cli, '--url', 'http://127.0.0.1:' + server.address().port], env: { SCENARIO_TOKEN: token }, stderr: 'pipe' });
  const client = new Client({ name: 'test-agent', version: '1' }); t.after(() => client.close());
  await client.connect(transport);
  assert.equal((await client.listTools()).tools[0].name, 'remote_only_tool');
  assert.equal((await client.callTool({ name: 'remote_only_tool', arguments: {} })).structuredContent.review.status, 'pending');
  await client.close();
});
test('never follows redirects carrying a token', async t => {
  let leaked = false;
  const server = http.createServer((req, res) => { if (req.url === '/leak') leaked = true; res.writeHead(307, { Location: '/leak' }); res.end(); });
  server.listen(0, '127.0.0.1'); await once(server, 'listening'); t.after(() => new Promise(resolve => server.close(resolve)));
  const client = new Client({ name: 'test', version: '1' });
  const transport = new StdioClientTransport({ command: process.execPath, args: [cli, '--url', 'http://127.0.0.1:' + server.address().port], env: { SCENARIO_TOKEN: token }, stderr: 'pipe' });
  await assert.rejects(client.connect(transport)); await client.close(); assert.equal(leaked, false);
});
