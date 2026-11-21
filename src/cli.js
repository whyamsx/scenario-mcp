#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

try {
  const { values } = parseArgs({ options: { url: { type: 'string' }, help: { type: 'boolean', short: 'h' }, version: { type: 'boolean' } } });
  if (values.help || values.version) {
    console.log(values.version ? '0.2.0' : 'scenario-mcp [--url https://scenario-mcp.whyamsx.com]\nSet SCENARIO_TOKEN in your agent configuration. Requires Node.js 22+.');
  } else {
    const url = new URL(values.url || process.env.SCENARIO_URL || 'https://scenario-mcp.whyamsx.com');
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || !['/', '/mcp'].includes(url.pathname) || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) throw new Error('Use an HTTPS service URL. HTTP is allowed only on localhost.');
    url.pathname = '/mcp';
    const token = process.env.SCENARIO_TOKEN;
    if (!token || !/^sst_[^\s]{1,124}$/.test(token)) throw new Error('Set SCENARIO_TOKEN to a token from your Scenario account.');
    const remote = new StreamableHTTPClientTransport(url, {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
      fetch: (input, init) => fetch(input, { ...init, redirect: 'error' }),
    });
    const localTransport = new StdioServerTransport();
    let closing = false;
    const close = async () => { if (closing) return; closing = true; await Promise.allSettled([remote.close(), localTransport.close()]); };
    remote.onmessage = message => { void localTransport.send(message).catch(close); };
    localTransport.onmessage = message => { void remote.send(message).catch(async error => {
      if ('id' in message) await localTransport.send({ jsonrpc: '2.0', id: message.id, error: { code: -32000, message: error?.code === 401 ? 'HTTP 401: token is invalid or expired.' : 'Could not connect to Scenario. Check the service URL and token.' } }).catch(() => {});
      await close();
    }); };
    remote.onerror = () => {}; // Transport errors are returned without headers or secrets.
    localTransport.onerror = () => { void close(); };
    localTransport.onclose = () => { void close(); };
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void close(); });
    await remote.start();
    await localTransport.start();
  }
} catch {
  console.error('Scenario MCP could not start. Check Node.js 22+, the HTTPS service URL and SCENARIO_TOKEN.');
  process.exitCode = 1;
}
