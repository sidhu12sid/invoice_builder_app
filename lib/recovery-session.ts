import { cookies } from 'next/headers';
import type { Session } from '@supabase/supabase-js';
import { seal, unseal } from './session-crypto';

const COOKIE = 'invoice-recovery';
export async function saveRecovery(session: Session, expires = Date.now() + 10 * 60_000) {
  (await cookies()).set(COOKIE, seal({ purpose: 'recovery', access: session.access_token,
    refresh: session.refresh_token, tokenExpires: session.expires_at! * 1000,
    expires, remember: false }), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict',
    path: '/api/auth', expires: new Date(expires),
  });
}
export async function getRecovery() {
  const raw = (await cookies()).get(COOKIE)?.value;
  const session = raw ? unseal(raw) : null;
  return session?.purpose === 'recovery' ? session : null;
}
export async function clearRecovery() {
  (await cookies()).set(COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/api/auth', maxAge: 0 });
}
