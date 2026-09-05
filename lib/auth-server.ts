import { cookies } from 'next/headers';
import { createClient, type Session } from '@supabase/supabase-js';
import { seal, unseal, REMEMBER_SECONDS, type LoginSession } from './session-crypto';

const COOKIE = 'invoice-session';
export function authClient(token?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase authentication is not configured.');
  return createClient(url, key, { global: token ? { headers: { Authorization: `Bearer ${token}` } } : {}, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

export async function writeSession(value: LoginSession) {
  (await cookies()).set(COOKIE, seal(value), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/',
    ...(value.remember ? { expires: new Date(value.expires) } : {}),
  });
}

export async function startSession(session: Session, remember: boolean) {
  await writeSession({ access: session.access_token, refresh: session.refresh_token,
    tokenExpires: session.expires_at! * 1000, remember,
    expires: Date.now() + (remember ? REMEMBER_SECONDS : 12 * 60 * 60) * 1000 });
}

export async function clearSession() { (await cookies()).delete(COOKIE); }

export async function readSession(refresh = false) {
  const raw = (await cookies()).get(COOKIE)?.value;
  const session = raw ? unseal(raw) : null;
  if (!session || session.purpose === 'recovery') return null;
  const sb = authClient();
  if (session.tokenExpires <= Date.now() + 60_000) {
    if (!refresh) return null;
    const { data, error } = await sb.auth.refreshSession({ refresh_token: session.refresh });
    if (error || !data.session) return null;
    session.access = data.session.access_token;
    session.refresh = data.session.refresh_token;
    session.tokenExpires = data.session.expires_at! * 1000;
    await writeSession(session); // Preserve the original absolute deadline.
  }
  const { data, error } = await sb.auth.getUser(session.access);
  if (error || !data.user?.email_confirmed_at) return null;
  const { data: account, error: accountError } = await authClient(session.access).from('users')
    .select('is_active').eq('id', data.user.id).maybeSingle();
  if (accountError) throw new Error('User database is not ready. Apply the authentication migration.');
  if (!account?.is_active) return null;
  return { session, user: data.user };
}
