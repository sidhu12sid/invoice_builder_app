'use client';

import { useState } from 'react';
import { Client, emptyClient } from '@/lib/clients';

type Props = {
  clients: Client[];
  loading: boolean;
  onSave: (client: Client) => Promise<void>;
  onDelete: (client: Client) => Promise<void>;
};

export default function ClientsView({
  clients,
  loading,
  onSave,
  onDelete,
}: Props) {
  const [draft, setDraft] = useState<Client>(emptyClient());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const editing = Boolean(draft.id);
  const set = (patch: Partial<Client>) => setDraft({ ...draft, ...patch });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) {
      setError('A client name is required.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onSave(draft);
      setDraft(emptyClient());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <header className="page__head">
        <h1 className="page__title">Clients</h1>
        <p className="page__sub">
          Saved here, a client can be picked when creating an invoice and their
          details fill in automatically.
        </p>
      </header>

      <div className="page__cols">
        <form className="card" onSubmit={submit}>
          <h2 className="card__title">
            {editing ? 'Edit client' : 'Add a client'}
          </h2>

          <label className="field">
            <span>Client name</span>
            <input
              value={draft.name}
              placeholder="Acme Pvt Ltd"
              onChange={(e) => set({ name: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Address</span>
            <textarea
              rows={3}
              value={draft.address}
              placeholder="Infopark, Kochi, Kerala, State Code: 32 PIN: 682042"
              onChange={(e) => set({ address: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={draft.email}
              placeholder="accounts@acme.com"
              onChange={(e) => set({ email: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Phone</span>
            <input
              value={draft.phone}
              placeholder="+91 000 000 0000"
              onChange={(e) => set({ phone: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Hourly rate</span>
            <input
              inputMode="decimal"
              value={draft.rate}
              placeholder="1000"
              onChange={(e) => set({ rate: e.target.value })}
            />
          </label>
          <p className="hint hint--tight">
            Used to work out each line’s price from billable hours. Leave blank
            to type prices by hand.
          </p>

          {error && <p className="msg msg--error">{error}</p>}

          <div className="card__actions">
            {editing && (
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => {
                  setDraft(emptyClient());
                  setError('');
                }}
              >
                Cancel
              </button>
            )}
            <button className="btn" type="submit" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Add client'}
            </button>
          </div>
        </form>

        <div className="card">
          <h2 className="card__title">
            Saved clients{clients.length ? ` (${clients.length})` : ''}
          </h2>

          {loading ? (
            <p className="hint">Loading…</p>
          ) : !clients.length ? (
            <p className="hint">
              No clients yet. Add one on the left and it'll be selectable when
              you create an invoice.
            </p>
          ) : (
            <ul className="saved">
              {clients.map((client) => (
                <li
                  key={client.id}
                  className={`saved__row${
                    client.id === draft.id ? ' is-current' : ''
                  }`}
                >
                  <div className="clientRow">
                    <span className="saved__title">{client.name}</span>
                    {client.email && (
                      <span className="saved__date">{client.email}</span>
                    )}
                    {client.phone && (
                      <span className="saved__date">{client.phone}</span>
                    )}
                    {client.rate.trim() && (
                      <span className="saved__date">
                        Rate: {client.rate} / hr
                      </span>
                    )}
                    {client.address && (
                      <span className="clientRow__address">
                        {client.address}
                      </span>
                    )}
                  </div>

                  <div className="saved__actions">
                    <button
                      type="button"
                      className="btn btn--tiny"
                      onClick={() => {
                        setDraft(client);
                        setError('');
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="btn btn--tiny btn--danger"
                      onClick={async () => {
                        if (!confirm(`Delete "${client.name}"?`)) return;
                        if (draft.id === client.id) setDraft(emptyClient());
                        await onDelete(client);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
