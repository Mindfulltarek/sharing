import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { cloudApi, setGoogleIdToken } from '../services/cloudApi';

test('account APIs and cloud-share pages carry the Google bearer token', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ path: string; authorization: string | null }> = [];
  globalThis.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const headers = new Headers(init?.headers);
    requests.push({ path: url, authorization: headers.get('Authorization') });
    if (url.includes('/api/v1/me')) return new Response(JSON.stringify({ user: { googleSub: 'sub', email: 'user@example.com', displayName: 'User', pictureUrl: null } }), { status: 200 });
    return new Response(JSON.stringify({ requiresPassword: true }), { status: 200 });
  };

  try {
    setGoogleIdToken('google-id-token');
    await cloudApi.me();
    await cloudApi.getPublicShare('share-token-example');
    assert.equal(requests.length, 2);
    assert.ok(requests.every((request) => request.authorization === 'Bearer google-id-token'));
  } finally {
    setGoogleIdToken(null);
    globalThis.fetch = originalFetch;
  }
});

test('the account app and utility services contain no local project or file repository path', () => {
  const appSource = readFileSync(fileURLToPath(new URL('../App.tsx', import.meta.url)), 'utf8');
  const servicesSource = readFileSync(fileURLToPath(new URL('../services.ts', import.meta.url)), 'utf8');
  assert.doesNotMatch(appSource, /continueWithoutAccount|localProjectRepository|localVaultRepository|rememberFiles|downloadProjectZip/);
  assert.doesNotMatch(servicesSource, /localStorage|fileCache|rememberFiles|writeProjects/);
});
