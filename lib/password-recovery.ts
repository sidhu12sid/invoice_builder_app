import type { SupabaseClient, Session } from '@supabase/supabase-js';

type RecoveryAuth = Pick<SupabaseClient['auth'], 'resetPasswordForEmail' | 'verifyOtp' | 'updateUser' | 'signOut' | 'refreshSession'>;
const response = (status: number, body: { error?: string; message?: string; ok?: boolean }, session?: Session) => ({ status, body, session });

export function authEmailFailure(error: { status?: number; code?: string }) {
  if (error.code === 'over_email_send_rate_limit') return response(429, { error: 'Supabase’s email sending limit has been reached. Try later; the administrator can check Auth rate limits and SMTP settings.' });
  if (error.status === 429 || error.code === 'over_request_rate_limit') return response(429, { error: 'Too many requests. Please wait before sending another email.' });
  if (error.code === 'email_address_not_authorized') return response(503, { error: 'Supabase’s default email service cannot send to this address. Configure a custom SMTP provider in Supabase Authentication.' });
  if (error.code === 'email_provider_disabled') return response(503, { error: 'Email authentication is disabled in Supabase. Contact the administrator.' });
  if (error.code === 'captcha_failed') return response(503, { error: 'Supabase requires CAPTCHA verification. The administrator must configure CAPTCHA support in this app.' });
  return response(503, { error: 'Supabase could not send the email. Check Authentication logs and SMTP provider settings, then try again.' });
}

/** Recovery tokens and sessions never become ordinary invoice login sessions. */
export async function passwordRecovery(action: 'forgot-password' | 'verify-recovery' | 'reset-password', body: Record<string, unknown>, auth: RecoveryAuth, options: { redirectTo?: string; refreshToken?: string } = {}) {
  if (action === 'verify-recovery') {
    if (typeof body.tokenHash !== 'string' || !/^[a-f0-9]{32,256}$/i.test(body.tokenHash)) return response(400, { error: 'This reset link is invalid. Request a new link.' });
    const { data, error } = await auth.verifyOtp({ token_hash: body.tokenHash, type: 'recovery' });
    if (error || !data.session || !data.user) return response(400, { error: 'This reset link is invalid, expired, or already used. Request a new link.' });
    return response(200, { ok: true }, data.session);
  }
  if (action === 'forgot-password') {
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return response(400, { error: 'Enter a valid email address.' });
  }
    const { error } = await auth.resetPasswordForEmail(email, { redirectTo: options.redirectTo });
    if (error && error.code !== 'user_not_found') return authEmailFailure(error);
    // Identical response for existing and unknown addresses; recovery never signs up a user.
    return response(200, { ok: true, message: 'If an account exists for this email, we’ve sent a password reset link. Check your inbox and spam folder.' });
  }
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 12 || password.length > 128) return response(400, { error: 'Use a password between 12 and 128 characters.' });
  if (password !== body.confirmPassword) return response(400, { error: 'Passwords do not match.' });
  if (!options.refreshToken) return response(401, { error: 'Open the verification link from your email before resetting your password.' });
  // Refresh checks server-side revocation, preventing reuse after a successful reset.
  const { data, error } = await auth.refreshSession({ refresh_token: options.refreshToken });
  if (error || !data.session || !data.user) return response(401, { error: 'Your reset session expired. Request a new link.' });
    const { error: updateError } = await auth.updateUser({ password });
    if (updateError) return response(400, { error: 'Password could not be changed. Choose a different password and try again.' }, data.session);
    // Revoke the recovery session and other refresh sessions. Existing access
    // JWTs can remain valid until their expiry; do not claim instant revocation.
    await auth.signOut({ scope: 'global' }).catch(() => undefined);
    return response(200, { ok: true });
}
