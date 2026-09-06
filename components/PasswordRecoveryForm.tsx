'use client';

import Link from 'next/link';
import PasswordField from './PasswordField';
import AuthLayout from './AuthLayout';
import { useEffect, useRef, useState, type FormEvent } from 'react';

export default function PasswordRecoveryForm({ reset = false }: { reset?: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [verification, setVerification] = useState<'checking' | 'ready' | 'invalid'>('checking');
  const started = useRef(false);
  useEffect(() => {
    if (!reset || started.current) return;
    started.current = true;
    const tokenHash = new URLSearchParams(window.location.hash.slice(1)).get('token_hash');
    // Remove the single-use credential from history before verifying it.
    window.history.replaceState(null, '', '/reset-password');
    void (async () => {
      try {
        const response = tokenHash
          ? await fetch('/api/auth/verify-recovery', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tokenHash }) })
          : await fetch('/api/auth/recovery-session', { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || !result.ok) throw new Error(result.error || 'Open the verification link from your email, or request a new link.');
        setVerification('ready');
        setNotice('Email link verified. Enter and confirm your new password below.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to verify this link. Request a new one.');
        setVerification('invalid');
      }
    })();
  }, [reset]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || (!reset && cooldown > 0) || (reset && verification !== 'ready')) return;
    setError(''); setNotice('');
    if (reset && password !== confirmPassword) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${reset ? 'reset-password' : 'forgot-password'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reset ? { password, confirmPassword } : { email }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (!reset && response.status === 429) setCooldown(60);
        if (reset && response.status === 401) setVerification('invalid');
        throw new Error(result.error || 'Unable to complete the request.');
      }
      if (reset) window.location.replace('/login?passwordReset=1');
      else { setNotice(result.message); setCooldown(60); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Please try again later.'); }
    finally { setBusy(false); }
  }

  return <AuthLayout mode={reset ? 'reset-password' : 'forgot-password'}><form className="authCard" onSubmit={submit}>
    <p className="accountStep">ACCOUNT RECOVERY</p>
    <h1 className="appTitle">{reset ? 'Reset your password' : 'Forgot password?'}</h1>
    <p className="appSub">{reset ? 'Once your email link is verified, choose a new password.' : 'Enter your account email. We’ll send a verification link to reset your password.'}</p>
    {reset && verification === 'checking' && <p role="status">Verifying your link…</p>}
    {(!reset || verification === 'ready') && <fieldset disabled={busy} className="authFields">
      {!reset && <label className="field"><span>Email</span><input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>}
      {reset && <>
        <PasswordField label="New password" minLength={12} autoComplete="new-password" value={password} onChange={setPassword} hint="Use 12–128 characters and a password you haven’t used before." />
        <PasswordField label="Confirm new password" minLength={12} autoComplete="new-password" value={confirmPassword} onChange={setConfirmPassword} />
      </>}
      <button className="btn authSubmit" disabled={busy || (!reset && cooldown > 0)}>{busy ? 'Please wait…' : reset ? 'Save new password' : cooldown ? `Resend link in ${cooldown}s` : 'Send reset link'}</button>
    </fieldset>}
    {error && <p className="msg msg--error" role="alert">{error}</p>}
    {notice && <p className="msg msg--ok" role="status">{notice}</p>}
    {reset && <p className="hint"><Link href="/forgot-password">Request a new reset link</Link></p>}
    <p className="hint authSwap"><Link href="/login">Back to sign in</Link></p>
  </form></AuthLayout>;
}
