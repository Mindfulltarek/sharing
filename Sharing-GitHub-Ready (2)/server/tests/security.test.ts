import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanFileName, cleanRelativePath, hashIpAddress, hashPassphrase, issueScopedToken, verifyPassphrase, verifyScopedToken } from '../security';

test('passphrase hashes verify the secret without storing plaintext', async () => {
  const hash = await hashPassphrase('correct horse battery staple');
  assert.notEqual(hash, 'correct horse battery staple');
  assert.match(hash, /^scrypt\$/);
  assert.equal(await verifyPassphrase('correct horse battery staple', hash), true);
  assert.equal(await verifyPassphrase('incorrect password', hash), false);
});

test('scoped tokens are limited to their purpose and subject', () => {
  process.env.ACCESS_TOKEN_SECRET = 'test-secret-that-is-at-least-32-characters-long';
  const token = issueScopedToken('project-123', 'share-password', 60);
  assert.equal(verifyScopedToken(token, 'share-password', 'project-123'), true);
  assert.equal(verifyScopedToken(token, 'vault', 'project-123'), false);
  assert.equal(verifyScopedToken(token, 'share-password', 'project-456'), false);
  const parts = token.split('.');
  parts[1] = `${parts[1].slice(0, -1)}x`;
  assert.equal(verifyScopedToken(parts.join('.'), 'share-password', 'project-123'), false);
});

test('expired scoped tokens are rejected', () => {
  process.env.ACCESS_TOKEN_SECRET = 'test-secret-that-is-at-least-32-characters-long';
  const token = issueScopedToken('user-123', 'vault', -1);
  assert.equal(verifyScopedToken(token, 'vault', 'user-123'), false);
});

test('file names and relative paths cannot introduce traversal or control characters', () => {
  assert.equal(cleanFileName('../secrets.txt'), '.._secrets.txt');
  assert.equal(cleanFileName('folder\\report\n.pdf'), 'folder_report_.pdf');
  assert.equal(cleanRelativePath('../../folder/report.pdf', 'report.pdf'), 'folder/report.pdf');
  assert.equal(cleanRelativePath('', 'report.pdf'), null);
});

test('IP rate-limit values are keyed digests, not stored addresses', () => {
  const address = '203.0.113.20';
  const digest = hashIpAddress(address, 'different-secret-with-at-least-32-chars');
  assert.notEqual(digest, address);
  assert.equal(digest, hashIpAddress(address, 'different-secret-with-at-least-32-chars'));
  assert.notEqual(digest, hashIpAddress(address, 'another-secret-with-at-least-32-chars'));
});
