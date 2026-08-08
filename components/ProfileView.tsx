'use client';

import { useEffect, useState } from 'react';
import { Profile } from '@/lib/profile';

type Props = {
  profile: Profile;
  loading: boolean;
  onSave: (profile: Profile) => Promise<void>;
};

export default function ProfileView({ profile, loading, onSave }: Props) {
  const [draft, setDraft] = useState<Profile>(profile);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  // Adopt the loaded profile once it arrives.
  useEffect(() => setDraft(profile), [profile]);

  const set = (patch: Partial<Profile>) => setDraft({ ...draft, ...patch });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await onSave(draft);
      setStatus('Saved. New invoices will use these details.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="bootMsg">Loading…</p>;

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">My details</h1>
        <p className="page__sub">
          These fill in the top-left block and the payment instructions on every
          new invoice.
        </p>
      </header>

      <form className="card card--narrow" onSubmit={submit}>
        <h2 className="card__title">Your details</h2>

        <label className="field">
          <span>Full name</span>
          <input
            value={draft.fullName}
            placeholder="Moosa Rahman"
            onChange={(e) => set({ fullName: e.target.value })}
          />
        </label>

        <label className="field">
          <span>Address line 1</span>
          <input
            value={draft.addressLine1}
            placeholder="42 Marine Drive"
            onChange={(e) => set({ addressLine1: e.target.value })}
          />
        </label>

        <label className="field">
          <span>Address line 2</span>
          <input
            value={draft.addressLine2}
            placeholder="Kochi, Kerala PIN: 682031"
            onChange={(e) => set({ addressLine2: e.target.value })}
          />
        </label>

        <label className="field">
          <span>Phone</span>
          <input
            value={draft.phone}
            placeholder="+91 00000 00000"
            onChange={(e) => set({ phone: e.target.value })}
          />
        </label>

        <h2 className="card__title card__title--spaced">Payment details</h2>

        <label className="field">
          <span>Bank account number</span>
          <input
            value={draft.accountNo}
            placeholder="0000000000000000"
            onChange={(e) => set({ accountNo: e.target.value })}
          />
        </label>

        <div className="grid2">
          <label className="field">
            <span>IFSC code</span>
            <input
              value={draft.ifsc}
              placeholder="XXXX0000000"
              onChange={(e) => set({ ifsc: e.target.value })}
            />
          </label>
          <label className="field">
            <span>PAN number</span>
            <input
              value={draft.pan}
              placeholder="XXXXX0000X"
              onChange={(e) => set({ pan: e.target.value })}
            />
          </label>
        </div>

        {error && <p className="msg msg--error">{error}</p>}
        {status && <p className="msg msg--ok">{status}</p>}

        <div className="card__actions">
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save my details'}
          </button>
        </div>
      </form>
    </div>
  );
}
