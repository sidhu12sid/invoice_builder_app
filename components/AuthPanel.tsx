'use client';

import { useState } from 'react';
import { getSupabase } from '@/lib/supabase';

export default function AuthPanel() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;

    setBusy(true);
    setError('');
    setNotice('');

    try {
      if (mode === 'signup') {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        // With "Confirm email" on, there's no session until the link is clicked.
        if (!data.session) {
          setNotice('Check your email to confirm the account, then sign in.');
        }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="authWrap">
      <form className="authCard" onSubmit={submit}>
        <h1 className="appTitle">Invoice Generator</h1>
        <p className="appSub">
          {mode === 'signin'
            ? 'Sign in to load your saved invoices.'
            : 'Create your account to start saving invoices.'}
        </p>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            required
            minLength={6}
            autoComplete={
              mode === 'signin' ? 'current-password' : 'new-password'
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {error && <p className="msg msg--error">{error}</p>}
        {notice && <p className="msg msg--ok">{notice}</p>}

        <button className="btn authSubmit" type="submit" disabled={busy}>
          {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        <p className="hint authSwap">
          {mode === 'signin' ? "Don't have an account?" : 'Already registered?'}{' '}
          <button
            type="button"
            className="linkBtn"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setError('');
              setNotice('');
            }}
          >
            {mode === 'signin' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </form>
    </div>
  );
}
