'use client';

import Link from 'next/link';
import PasswordField from './PasswordField';
import AuthLayout from './AuthLayout';
import { useEffect, useState, type FormEvent } from 'react';

export default function AccountForm({ mode }: { mode: 'login' | 'signup' | 'verify' }) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [otp, setOtp] = useState('');
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (mode === 'verify') {
      try { setEmail(sessionStorage.getItem('invoice:verification-email') || ''); }
      catch { /* The user can enter their email if browser storage is blocked. */ }
    }
    if (mode === 'login' && new URLSearchParams(window.location.search).has('verified')) {
      setNotice('Email verified. You can now sign in.');
    }
    if (mode === 'login' && new URLSearchParams(window.location.search).has('passwordReset')) {
      setNotice('Password reset successfully. Sign in with your new password.');
    }
  }, [mode]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function submit(event: FormEvent, resend = false) {
    event.preventDefault();
    if (busy || (resend && cooldown > 0)) return;
    setError(''); setNotice('');
    if (mode === 'signup' && password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/auth/${resend ? 'resend' : mode}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, firstName, lastName, password, otp, remember }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (resend && response.status === 429) setCooldown(60);
        throw new Error(result.error || 'Please try again.');
      }
      if (resend) { setNotice('If the account needs verification, a new code has been sent.'); setCooldown(60); return; }
      if (mode === 'signup') {
        try { sessionStorage.setItem('invoice:verification-email', email.trim()); }
        catch { /* Remembering the email must not block verification. */ }
        window.location.assign('/verify-email');
      } else if (mode === 'verify') {
        try { sessionStorage.removeItem('invoice:verification-email'); }
        catch { /* Successful verification must always continue to sign in. */ }
        window.location.replace('/login?verified=1');
      } else window.location.replace('/');
    } catch (err) { setError(err instanceof Error ? err.message : 'Please try again.'); }
    finally { setBusy(false); }
  }

  return <AuthLayout mode={mode}><form className="authCard" onSubmit={submit}>
    <p className="accountStep">{mode === 'login' ? 'YOUR INVOICING WORKSPACE' : mode === 'signup' ? 'GET STARTED' : 'ONE LAST STEP'}</p>
    <h1 className="appTitle">{mode === 'signup' ? 'Create your account' : mode === 'verify' ? 'OTP verification' : 'Welcome back'}</h1>
    <p className="appSub">{mode === 'signup' ? 'Create an Invoice Generator account. We’ll email you a verification code.' : mode === 'verify' ? 'Enter the OTP sent to your signup email. After verification, you’ll be redirected to sign in.' : 'Sign in to create and manage your invoices.'}</p>
    <fieldset disabled={busy} className="authFields">
      {mode === 'signup' && <div className="accountNames">
        <label className="field"><span>First name</span><input required maxLength={100} autoComplete="given-name" value={firstName} onChange={e => setFirstName(e.target.value)} /></label>
        <label className="field"><span>Last name</span><input required maxLength={100} autoComplete="family-name" value={lastName} onChange={e => setLastName(e.target.value)} /></label>
      </div>}
      <label className="field"><span>Email</span><input type="email" required maxLength={254} autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      {mode !== 'verify' && <PasswordField label="Password" minLength={mode === 'signup' ? 12 : 1} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={setPassword} hint={mode === 'signup' ? 'Use at least 12 characters.' : undefined} />}
      {mode === 'signup' && <PasswordField label="Confirm password" autoComplete="new-password" value={confirm} onChange={setConfirm} />}
      {mode === 'verify' && <label className="field"><span>Verification code</span><input className="accountOtp" placeholder="Enter code" required inputMode="numeric" pattern="[0-9]{6,10}" maxLength={10} autoComplete="one-time-code" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} /></label>}
      {mode === 'login' && <div className="accountOptions"><label className="authRemember"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} /> Remember me for 45 days</label><Link href="/forgot-password">Forgot password?</Link></div>}
      <button className="btn authSubmit" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'verify' ? 'Verify OTP and continue' : 'Sign in'}</button>
    </fieldset>
    {error && <p role="alert" className="msg msg--error">{error}</p>}
    {notice && <p role="status" className="msg msg--ok">{notice}</p>}
    {mode === 'verify' && <p className="hint">Didn’t receive an OTP? <button type="button" className="linkBtn" disabled={busy || cooldown > 0 || !email} onClick={e => submit(e, true)}>{cooldown ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}</button></p>}
    <p className="hint authSwap">{mode === 'login' ? <>New here? <Link href="/signup">Create account</Link></> : <Link href="/login">Back to sign in</Link>}</p>
  </form></AuthLayout>;
}
