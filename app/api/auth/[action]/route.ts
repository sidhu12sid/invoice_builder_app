import { NextResponse } from 'next/server';
import { authClient, readSession, startSession, clearSession } from '@/lib/auth-server';
import { passwordRecovery, authEmailFailure } from '@/lib/password-recovery';
import { getRecovery, saveRecovery, clearRecovery } from '@/lib/recovery-session';

export const runtime = 'nodejs';
const reply = (data: object, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

export async function GET(_request: Request, context: { params: Promise<{ action: string }> }) {
  if ((await context.params).action === 'recovery-session') {
    return reply({ ok: Boolean(await getRecovery()) });
  }
  if ((await context.params).action !== 'session') return reply({ error: 'Not found.' }, 404);
  try {
    const result = await readSession(true);
    if (!result) { await clearSession(); return reply({ user: null }, 401); }
    return reply({ user: result.user, access_token: result.session.access });
  } catch { return reply({ error: 'Authentication is unavailable. Check the server configuration and user migration.' }, 503); }
}

export async function POST(request: Request, context: { params: Promise<{ action: string }> }) {
  if (request.headers.get('origin') !== new URL(request.url).origin) return reply({ error: 'Invalid request origin.' }, 403);
  const { action } = await context.params;
  try {
    if (action === 'logout') {
      try {
        const result = await readSession(true);
        if (result) await authClient().auth.admin.signOut(result.session.access, 'local');
      } finally { await clearSession(); }
      return reply({ ok: true });
    }
    if (!['signup', 'login', 'verify', 'resend', 'forgot-password', 'verify-recovery', 'reset-password'].includes(action)) return reply({ error: 'Not found.' }, 404);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return reply({ error: 'Invalid request.' }, 400);
    if (action === 'forgot-password' || action === 'verify-recovery' || action === 'reset-password') {
      const recovery = action === 'reset-password' ? await getRecovery() : null;
      const result = await passwordRecovery(action, body, authClient().auth, {
        redirectTo: `${new URL(request.url).origin}/reset-password`,
        refreshToken: recovery?.refresh,
      });
      if (result.session) await saveRecovery(result.session, recovery?.expires);
      if (action === 'reset-password' && result.body.ok) { await clearRecovery(); await clearSession(); }
      if (action === 'reset-password' && result.status === 401) await clearRecovery();
      return reply(result.body, result.status);
    }
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply({ error: 'Enter a valid email address.' }, 400);
    const sb = authClient();
    if (action === 'resend') {
      const { error } = await sb.auth.resend({ type: 'signup', email });
      if (error && error.code !== 'user_not_found') {
        const result = authEmailFailure(error);
        return reply(result.body, result.status);
      }
      return reply({ ok: true });
    }
    if (action === 'verify') {
      if (typeof body.otp !== 'string' || !/^\d{6,10}$/.test(body.otp)) return reply({ error: 'Enter the verification code from your email.' }, 400);
      const { data, error } = await sb.auth.verifyOtp({ email, token: body.otp, type: 'email' });
      if (error || !data.user?.email_confirmed_at) return reply({ error: 'The code is invalid or expired. Request a new code and try again.' }, 400);
      if (data.session) await sb.auth.signOut({ scope: 'local' });
      return reply({ ok: true });
    }
    const password = typeof body.password === 'string' ? body.password : '';
    if (!password || password.length > 128) return reply({ error: 'Enter a password of at most 128 characters.' }, 400);
    if (action === 'signup') {
      const first = typeof body.firstName === 'string' ? body.firstName.trim() : '';
      const last = typeof body.lastName === 'string' ? body.lastName.trim() : '';
      if (!first || !last || first.length > 100 || last.length > 100) return reply({ error: 'First and last names are required (maximum 100 characters each).' }, 400);
      if (password.length < 12) return reply({ error: 'Use at least 12 characters for your password.' }, 400);
      const { data, error } = await sb.auth.signUp({ email, password, options: {
        data: { first_name: first, last_name: last },
      } });
      if (error) return reply({ error: error.status === 429 ? 'Please wait before trying again.' : 'Unable to create account. Try again or sign in if you already registered.' }, 400);
      if (data.session) {
        await sb.auth.signOut({ scope: 'local' });
        return reply({ error: 'Email confirmation must be enabled in Supabase before signup can be used.' }, 503);
      }
      return reply({ ok: true });
    }
    if (typeof body.remember !== 'boolean') return reply({ error: 'Invalid login request.' }, 400);
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error || !data.session || !data.user.email_confirmed_at) return reply({ error: 'Unable to sign in. Check your email and password, and verify your email first.' }, 401);
    const { data: account, error: dbError } = await sb.from('users').select('is_active').eq('id', data.user.id).maybeSingle();
    if (dbError || !account?.is_active) {
      await sb.auth.signOut({ scope: 'local' });
      return reply({ error: dbError ? 'User database is not ready. Apply the authentication migration.' : 'This account is inactive. Contact the administrator.' }, dbError ? 503 : 403);
    }
    await startSession(data.session, body.remember);
    return reply({ ok: true });
  } catch {
    return reply({ error: 'Authentication is unavailable. Please try again later.' }, 503);
  }
}
