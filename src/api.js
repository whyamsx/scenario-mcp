const MAX_BYTES = 16 * 1024 * 1024;

export class ScenarioAPI {
  constructor(address, token) {
    let url;
    try { url = new URL(address); } catch { throw new Error('Set --url to your Scenario HTTPS address.'); }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' || (url.protocol !== 'https:' && !(local && url.protocol === 'http:'))) throw new Error('Use an HTTPS origin without path, query or credentials; HTTP is allowed only on localhost.');
    if (!/^sst_[A-Za-z0-9_-]{1,124}$/.test(token ?? '')) throw new Error('Set SCENARIO_TOKEN to a token from your account.');
    this.base = url.origin; this.token = token; this.workspace = '';
  }
  async request(method, path, body, signal) {
    const encoded = body === undefined ? undefined : JSON.stringify(body);
    if (encoded && Buffer.byteLength(encoded) > 4 * 1024 * 1024 + 65536) throw new Error('Request exceeds 4 MiB.');
    let response;
    const timeout = AbortSignal.timeout(20000);
    try {
      response = await fetch(this.base + path, {
        method, body: encoded, redirect: 'error', signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json', 'X-Scenario-Client': 'studio', ...(this.workspace ? { 'X-Scenario-Workspace': this.workspace } : {}) },
      });
    } catch { throw new Error('Cannot reach Scenario. Check its address, TLS certificate and connection. Redirects are not allowed.'); }
    const reader = response.body.getReader(), parts = []; let length = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        length += value.byteLength;
        if (length > MAX_BYTES) throw new Error('Response exceeds 16 MiB.');
        parts.push(value);
      }
    } finally { await reader.cancel().catch(() => {}); }
    let data;
    try { data = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { throw new Error(`Invalid API response (HTTP ${response.status}).`); }
    if (!response.ok) {
      const detail = response.status === 401 ? 'Token expired or revoked. Create a new token.' : response.status === 403 ? 'Access denied. Check token permissions.' : response.status === 409 ? 'Read the scenario again and merge changes; never blindly retry a stale revision.' : String(data.error ?? 'Request failed.').slice(0, 500).split(this.token).join('[redacted]');
      throw new Error(`HTTP ${response.status}: ${detail}`);
    }
    return data;
  }
  async check(signal) {
    const info = await this.request('GET', '/api/info', undefined, signal);
    if (info.apiVersion !== 1 || typeof info.workspace !== 'string' || !info.workspace) throw new Error('Unsupported Scenario API.');
    if (this.workspace && this.workspace !== info.workspace) throw new Error('Account changed. Restart the MCP client.');
    this.workspace = info.workspace;
  }
  async call(method, path, body, signal) { await this.check(signal); return this.request(method, path, body, signal); }
}
