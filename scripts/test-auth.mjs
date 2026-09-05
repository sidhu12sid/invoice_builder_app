import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { seal, unseal, REMEMBER_SECONDS } from '../lib/session-crypto.ts';

process.env.AUTH_SESSION_SECRET = randomBytes(32).toString('hex');
const sample = () => ({ access: 'access-token', refresh: 'secret-refresh-token', tokenExpires: Date.now() + 3600000, expires: Date.now() + REMEMBER_SECONDS * 1000, remember: true });

test('session roundtrip preserves the original 45-day deadline without revealing tokens', () => {
  const session = sample();
  const cookie = seal(session);
  assert.deepEqual(unseal(cookie), session);
  assert.equal(cookie.includes(session.refresh), false);
  assert.equal(REMEMBER_SECONDS, 3888000);
});
test('tampered, malformed and expired cookies are rejected', () => {
  const bytes = Buffer.from(seal(sample()), 'base64url');
  bytes[30] ^= 1;
  assert.equal(unseal(bytes.toString('base64url')), null);
  assert.equal(unseal('garbage'), null);
  assert.equal(unseal(seal({ ...sample(), expires: Date.now() - 1 })), null);
});
test('refreshing tokens cannot extend the absolute cookie deadline', () => {
  const original = sample();
  const refreshed = { ...unseal(seal(original)), access: 'new-access', refresh: 'new-refresh', tokenExpires: Date.now() + 7200000 };
  assert.equal(unseal(seal(refreshed)).expires, original.expires);
});
test('rotating the server secret invalidates existing cookies', () => {
  const cookie = seal(sample());
  process.env.AUTH_SESSION_SECRET = randomBytes(32).toString('hex');
  assert.equal(unseal(cookie), null);
});
test('missing server key prevents creating a session', () => {
  delete process.env.AUTH_SESSION_SECRET;
  assert.throws(() => seal(sample()), /AUTH_SESSION_SECRET/);
});
