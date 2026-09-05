import assert from 'node:assert/strict';
import { test } from 'node:test';
import { passwordRecovery, authEmailFailure } from '../lib/password-recovery.ts';

const valid = { password: 'a-new-long-password', confirmPassword: 'a-new-long-password' };
const tokenHash = 'a'.repeat(64);
function mock(overrides = {}) {
  const calls = [];
  const session = { access_token: 'access', refresh_token: 'rotated-refresh' };
  const auth = {
    resetPasswordForEmail: async (...args) => { calls.push(['send', ...args]); return { error: null }; },
    verifyOtp: async args => { calls.push(['verify', args]); return { data: { user: { id: 'user' }, session }, error: null }; },
    refreshSession: async args => { calls.push(['refresh', args]); return { data: { user: { id: 'user' }, session }, error: null }; },
    updateUser: async args => { calls.push(['update', args]); return { error: null }; },
    signOut: async args => { calls.push(['signout', args]); return { error: null }; },
    ...overrides,
  };
  return { auth, calls };
}
test('email request includes the reset destination and hides account existence', async () => {
  const { auth, calls } = mock();
  const body = { email: 'person@example.com' };
  const result = await passwordRecovery('forgot-password', body, auth, { redirectTo: 'https://example.com/reset-password' });
  assert.equal(result.status, 200);
  assert.match(result.body.message, /If an account exists/);
  assert.deepEqual(calls, [['send', body.email, { redirectTo: 'https://example.com/reset-password' }]]);
  const unknown = await passwordRecovery('forgot-password', body, mock({ resetPasswordForEmail: async () => ({ error: { status: 400, code: 'user_not_found' } }) }).auth);
  assert.deepEqual(unknown.body, result.body);
});
test('link verification uses recovery token hash and returns a private session', async () => {
  const { auth, calls } = mock();
  const result = await passwordRecovery('verify-recovery', { tokenHash }, auth);
  assert.equal(result.status, 200);
  assert.deepEqual(calls, [['verify', { token_hash: tokenHash, type: 'recovery' }]]);
  assert.ok(result.session);
  assert.deepEqual(result.body, { ok: true });
});
test('invalid, expired or reused links cannot create a recovery session', async () => {
  const { auth, calls } = mock();
  assert.equal((await passwordRecovery('verify-recovery', { tokenHash: 'bad' }, auth)).status, 400);
  assert.deepEqual(calls, []);
  const expired = mock({ verifyOtp: async () => ({ data: {}, error: { message: 'expired' } }) });
  const result = await passwordRecovery('verify-recovery', { tokenHash }, expired.auth);
  assert.equal(result.status, 400);
  assert.equal(result.session, undefined);
});
test('direct password reset without a verified recovery session fails', async () => {
  const { auth, calls } = mock();
  assert.equal((await passwordRecovery('reset-password', valid, auth)).status, 401);
  assert.deepEqual(calls, []);
});
test('invalid passwords are rejected before rotating the session', async () => {
  for (const body of [{ ...valid, password: 'short' }, { ...valid, confirmPassword: 'different' }]) {
    const { auth, calls } = mock();
    assert.equal((await passwordRecovery('reset-password', body, auth, { refreshToken: 'refresh' })).status, 400);
    assert.deepEqual(calls, []);
  }
});
test('revoked sessions cannot reset again', async () => {
  const { auth, calls } = mock({ refreshSession: async () => ({ data: {}, error: { message: 'revoked' } }) });
  assert.equal((await passwordRecovery('reset-password', valid, auth, { refreshToken: 'old' })).status, 401);
  assert.deepEqual(calls, []);
});
test('successful reset refreshes, changes password and signs out', async () => {
  const { auth, calls } = mock();
  assert.equal((await passwordRecovery('reset-password', valid, auth, { refreshToken: 'refresh' })).status, 200);
  assert.deepEqual(calls, [['refresh', { refresh_token: 'refresh' }], ['update', { password: valid.password }], ['signout', { scope: 'global' }]]);
});
test('provider rejection preserves rotated session so user can retry', async () => {
  const { auth } = mock({ updateUser: async () => ({ error: { message: 'same password' } }) });
  const result = await passwordRecovery('reset-password', valid, auth, { refreshToken: 'refresh' });
  assert.equal(result.status, 400);
  assert.equal(result.session.refresh_token, 'rotated-refresh');
});
test('rate limits and outages are surfaced', async () => {
  for (const status of [429, 503]) {
    const { auth } = mock({ resetPasswordForEmail: async () => ({ error: { status } }) });
    assert.equal((await passwordRecovery('forgot-password', { email: 'person@example.com' }, auth)).status, status);
  }
});

test('SMTP restrictions and other provider failures never claim a successful send', async () => {
  for (const code of ['email_address_not_authorized', 'email_provider_disabled', 'unexpected_failure', 'captcha_failed']) {
    const { auth } = mock({ resetPasswordForEmail: async () => ({ error: { status: 400, code } }) });
    const result = await passwordRecovery('forgot-password', { email: 'person@example.com' }, auth);
    assert.equal(result.status, 503);
    assert.equal(result.body.ok, undefined);
  }
  assert.match(authEmailFailure({ code: 'email_address_not_authorized' }).body.error, /custom SMTP/);
  assert.equal(authEmailFailure({ code: 'over_email_send_rate_limit' }).status, 429);
});
