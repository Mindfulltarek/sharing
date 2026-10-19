import assert from 'node:assert/strict';
import test from 'node:test';
import api from '../api';

async function call(path: string, method = 'GET') {
  return api.fetch(new Request(`https://sharing.test${path}`, { method }));
}

test('workspace, Vault, and cloud-share APIs reject requests without a Google ID token', async () => {
  delete process.env.GOOGLE_CLIENT_ID;
  for (const path of [
    '/api/v1/me',
    '/api/v1/projects',
    '/api/v1/shared',
    '/api/v1/vault/files',
    '/api/v1/public/shares/AbCdEf0123456789_-AbCdEf0123456789',
    '/api/v1/public/shares/AbCdEf0123456789_-AbCdEf0123456789/unlock',
  ]) {
    const response = await call(path);
    assert.equal(response.status, 401, path);
    const body = await response.json() as { error?: { code?: string } };
    assert.equal(body.error?.code, 'AUTH_REQUIRED', path);
  }
});

test('health remains publicly available for deployment checks', async () => {
  delete process.env.DATABASE_URL;
  const health = await call('/api/v1/health');
  assert.equal(health.status, 503);
  const healthBody = await health.json() as { error?: { code?: string } };
  assert.equal(healthBody.error?.code, 'BACKEND_NOT_CONFIGURED');
});
