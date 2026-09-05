'use client';
import { useState } from 'react';
import type { Currency } from '@/lib/currencies';

export default function CurrenciesView({ currencies, error, onAdd }: { currencies: Currency[]; error: string; onAdd: (currency: Currency) => Promise<void> }) {
  const [draft, setDraft] = useState({ code: '', name: '', symbol: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failure, setFailure] = useState('');
  return <div className="page">
    <header className="page__head"><h1 className="page__title">Currencies</h1><p className="page__sub">Add the currencies you use for clients and invoices.</p></header>
    {error && <p role="alert" className="msg msg--error">{error}</p>}
    <div className="page__cols">
      <form className="card" onSubmit={async event => {
        event.preventDefault(); setBusy(true); setFailure(''); setMessage('');
        try { await onAdd(draft); setDraft({ code: '', name: '', symbol: '' }); setMessage('Currency added.'); }
        catch (err) { setFailure(err instanceof Error ? err.message : 'Could not save currency.'); }
        finally { setBusy(false); }
      }}>
        <h2 className="card__title">Add currency</h2>
        <fieldset className="authFields" disabled={busy}>
          <label className="field"><span>Currency code</span><input required pattern="[A-Za-z]{3}" maxLength={3} placeholder="USD" value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value.toUpperCase() })} /></label>
          <label className="field"><span>Name</span><input required maxLength={80} placeholder="US dollar" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} /></label>
          <label className="field"><span>Symbol</span><input required maxLength={12} placeholder="$" value={draft.symbol} onChange={e => setDraft({ ...draft, symbol: e.target.value })} /></label>
          <button className="btn">{busy ? 'Saving…' : 'Add currency'}</button>
        </fieldset>
        {failure && <p role="alert" className="msg msg--error">{failure}</p>}
        {message && <p role="status" className="msg msg--ok">{message}</p>}
      </form>
      <div className="card"><h2 className="card__title">Your currencies</h2>
        {!currencies.length ? <p className="hint">No currencies added yet.</p> : <ul className="saved">{currencies.map(c => <li className="saved__row" key={c.code}><span>{c.code} — {c.name} ({c.symbol})</span></li>)}</ul>}
      </div>
    </div>
  </div>;
}
