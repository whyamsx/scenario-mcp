import { version } from './version.js';

export const versionHeader = 'X-Scenario-MCP-Client-Version';
export const contractHeader = 'X-Scenario-MCP-Contract';

// Pin the catalog seen during initialization. Ordinary responses must not adopt
// a newer catalog behind the agent's back; it still holds the previous schemas.
export function createCompatibilityFetch(fetchImpl = fetch) {
  let contract;
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    headers.set(versionHeader, version);
    if (contract) headers.set(contractHeader, contract);
    const initializes = typeof init?.body === 'string' && JSON.parse(init.body).method === 'initialize';
    const response = await fetchImpl(input, { ...init, headers, redirect: 'error' });
    if (initializes && response.ok) contract = response.headers.get(contractHeader) || undefined;
    return response;
  };
}
