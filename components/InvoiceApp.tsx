'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import InvoiceForm from './InvoiceForm';
import ScaledPreview from './ScaledPreview';
import AuthPanel from './AuthPanel';
import SendDialog from './SendDialog';
import Sidebar, { View } from './Sidebar';
import ClientsView from './ClientsView';
import ProfileView from './ProfileView';
import SavedInvoicesView from './SavedInvoicesView';

import {
  Invoice,
  applyClient,
  applyProfile,
  defaultInvoice,
  fillFromProfile,
  nextInvoiceNo,
} from '@/lib/invoice';
import { downloadInvoicePdf } from '@/lib/pdf';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  InvoiceStatus,
  SavedInvoice,
  deleteInvoice,
  listInvoices,
  markSent,
  saveInvoice,
} from '@/lib/store';
import { Client, deleteClient, listClients, saveClient } from '@/lib/clients';
import { Profile, emptyProfile, loadProfile, saveProfile } from '@/lib/profile';
import { describeDbError } from '@/lib/dbError';

const DRAFT_KEY = 'invoice-generator:draft';
const SIDEBAR_KEY = 'invoice-generator:sidebar-collapsed';

/** What the send dialog and PDF builder should act on. */
type Target = { data: Invoice; id: string | null };

export default function InvoiceApp() {
  const [view, setView] = useState<View>('create');
  const [collapsed, setCollapsed] = useState(false);

  const [data, setData] = useState<Invoice>(defaultInvoice);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);

  const [saved, setSaved] = useState<SavedInvoice[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [selectedSaved, setSelectedSaved] = useState<SavedInvoice | null>(null);

  const [clients, setClients] = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);

  const [profile, setProfile] = useState<Profile>(emptyProfile());
  const [profileLoading, setProfileLoading] = useState(false);

  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [sendTarget, setSendTarget] = useState<Target | null>(null);
  const [busyPdf, setBusyPdf] = useState(false);
  const [draftLoaded, setDraftLoaded] = useState(false);

  /* ---------------------------------------------------------- session -- */

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;

    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setAuthReady(true);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signedIn = !isSupabaseConfigured || Boolean(session);

  /* --------------------------------------------------------- sidebar -- */

  // Read after hydration so the server and client first render agree.
  useEffect(() => {
    setCollapsed(localStorage.getItem(SIDEBAR_KEY) === '1');
  }, []);

  const toggleSidebar = () =>
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
      } catch {
        /* storage blocked — the toggle still works for this session */
      }
      return next;
    });

  /* ------------------------------------------------------------ draft -- */

  // Restore unsaved work after hydration so server and client markup match.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setData({ ...defaultInvoice, ...parsed.data });
        setCurrentId(parsed.id ?? null);
      }
    } catch {
      /* ignore unreadable drafts */
    }
    setDraftLoaded(true);
  }, []);

  // Gated on the restore above: without the gate this effect runs on the very
  // first render with the *default* invoice still in state and overwrites the
  // stored draft before it has been read back.
  useEffect(() => {
    if (!draftLoaded) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ data, id: currentId }));
    } catch {
      /* storage blocked — the preview still works */
    }
  }, [data, currentId, draftLoaded]);

  /* -------------------------------------------------------- data load -- */

  const refresh = useCallback(async () => {
    if (!signedIn) return;
    setListLoading(true);
    setError('');
    try {
      const list = await listInvoices();
      setSaved(list);
      // Keep the previewed invoice pointing at fresh data, or drop it if it's
      // been deleted.
      setSelectedSaved((prev) =>
        prev ? list.find((x) => x.id === prev.id) ?? null : null
      );
    } catch (err) {
      setError(describeDbError(err, 'invoices'));
    } finally {
      setListLoading(false);
    }
  }, [signedIn]);

  const refreshClients = useCallback(async () => {
    if (!signedIn) return;
    setClientsLoading(true);
    try {
      setClients(await listClients());
    } catch (err) {
      setError(describeDbError(err, 'clients'));
    } finally {
      setClientsLoading(false);
    }
  }, [signedIn]);

  useEffect(() => {
    void refresh();
    void refreshClients();
  }, [refresh, refreshClients]);

  useEffect(() => {
    if (!signedIn || !draftLoaded) return;
    let cancelled = false;

    (async () => {
      setProfileLoading(true);
      try {
        const loaded = await loadProfile();
        if (cancelled) return;
        setProfile(loaded);
        // Fills only blank fields, so a restored draft keeps whatever's in it
        // and a loaded invoice keeps the details it was created with.
        setData((prev) => fillFromProfile(prev, loaded));
      } catch (err) {
        // Non-fatal: invoices still work, they just aren't pre-filled.
        if (!cancelled) setError(describeDbError(err, 'your details'));
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [signedIn, draftLoaded]);

  /* ---------------------------------------------------------- actions -- */

  const flash = (msg: string) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 2500);
  };

  const update = (patch: Partial<Invoice>) =>
    setData((prev) => ({ ...prev, ...patch }));

  const handleSave = async (nextStatus: InvoiceStatus) => {
    setError('');
    try {
      const id = await saveInvoice(data, currentId, nextStatus);
      setCurrentId(id);
      flash(nextStatus === 'draft' ? 'Saved as draft.' : 'Saved as final.');
      await refresh();
    } catch (err) {
      setError(describeDbError(err, 'invoices'));
    }
  };

  const handleDownloadPdf = async (invoice: Invoice) => {
    setError('');
    setBusyPdf(true);
    try {
      await downloadInvoicePdf(invoice);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the PDF.');
    } finally {
      setBusyPdf(false);
    }
  };

  const handleSent = async (recipient: string) => {
    const target = sendTarget;
    setSendTarget(null);
    if (!target) return;

    try {
      const id = await markSent(target.data, target.id, recipient);
      if (target.id === currentId) setCurrentId(id);
      flash(`Sent to ${recipient}.`);
      await refresh();
    } catch (err) {
      // The mail went out; only the bookkeeping failed.
      setError(
        `Email sent, but the invoice could not be marked as sent: ${
          err instanceof Error ? err.message : 'unknown error'
        }`
      );
    }
  };

  const handleNew = () => {
    setData(applyProfile(defaultInvoice, profile));
    setCurrentId(null);
    setView('create');
    flash('Started a new invoice.');
  };

  const handleEdit = (item: SavedInvoice) => {
    setData({ ...defaultInvoice, ...item.data });
    setCurrentId(item.id);
    setView('create');
    flash(`Editing ${item.title}.`);
  };

  const handleDuplicate = (item: SavedInvoice) => {
    const copy = { ...defaultInvoice, ...item.data };
    setData({ ...copy, invoiceNo: nextInvoiceNo(copy.invoiceNo) });
    setCurrentId(null); // saves as a new row
    setView('create');
    flash('Copied — invoice number bumped. Save when ready.');
  };

  const handleDelete = async (item: SavedInvoice) => {
    if (!confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
    setError('');
    try {
      await deleteInvoice(item.id);
      if (currentId === item.id) setCurrentId(null);
      await refresh();
      flash('Deleted.');
    } catch (err) {
      setError(describeDbError(err, 'invoices'));
    }
  };

  const handleSaveClient = async (client: Client) => {
    try {
      await saveClient(client);
    } catch (err) {
      throw new Error(describeDbError(err, 'clients'));
    }
    await refreshClients();
    flash(client.id ? 'Client updated.' : 'Client added.');
  };

  const handleDeleteClient = async (client: Client) => {
    try {
      await deleteClient(client.id);
    } catch (err) {
      throw new Error(describeDbError(err, 'clients'));
    }
    await refreshClients();
    flash('Client deleted.');
  };

  const handleSaveProfile = async (next: Profile) => {
    try {
      await saveProfile(next);
    } catch (err) {
      throw new Error(describeDbError(err, 'your details'));
    }
    setProfile(next);
    setError('');
    // Reflect the change on an invoice that hasn't been saved yet.
    if (!currentId) setData((prev) => applyProfile(prev, next));
  };

  const handleSignOut = async () => {
    await getSupabase()?.auth.signOut();
    setSaved([]);
    setClients([]);
    setSelectedSaved(null);
    setProfile(emptyProfile());
    setCurrentId(null);
  };

  /* ------------------------------------------------------------ views -- */

  if (!authReady) return <p className="bootMsg">Loading…</p>;
  if (!signedIn) return <AuthPanel />;

  return (
    <div className={`shell${collapsed ? ' is-collapsed' : ''}`}>
      <Sidebar
        view={view}
        onChange={setView}
        account={session?.user.email ?? ''}
        synced={isSupabaseConfigured}
        collapsed={collapsed}
        onToggle={toggleSidebar}
        onSignOut={handleSignOut}
      />

      <main className="shell__main">
        {view === 'saved' && (
          <SavedInvoicesView
            items={saved}
            loading={listLoading}
            selected={selectedSaved}
            collapsed={collapsed}
            busyPdf={busyPdf}
            status={status}
            error={error}
            onSelect={setSelectedSaved}
            onEdit={handleEdit}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onPrint={() => window.print()}
            onDownloadPdf={() =>
              selectedSaved && handleDownloadPdf(selectedSaved.data)
            }
            onEmail={() =>
              selectedSaved &&
              setSendTarget({ data: selectedSaved.data, id: selectedSaved.id })
            }
          />
        )}

        {view === 'clients' && (
          <ClientsView
            clients={clients}
            loading={clientsLoading}
            onSave={handleSaveClient}
            onDelete={handleDeleteClient}
          />
        )}

        {view === 'profile' && (
          <ProfileView
            profile={profile}
            loading={profileLoading}
            onSave={handleSaveProfile}
          />
        )}

        {view === 'create' && (
          <div className="app">
            <div className="pane pane--form">
              <InvoiceForm
                data={data}
                onChange={update}
                clients={clients}
                onPickClient={(client) =>
                  setData((prev) => applyClient(prev, client))
                }
              />
            </div>

            <div className="pane pane--preview">
              <div className="toolbar">
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => handleSave('draft')}
                >
                  Save draft
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => handleSave('final')}
                >
                  Save as final
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={handleNew}
                >
                  New
                </button>

                <div className="toolbar__spacer" />

                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => handleDownloadPdf(data)}
                  disabled={busyPdf}
                >
                  {busyPdf ? 'Building…' : 'Download PDF'}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => window.print()}
                >
                  Print
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setSendTarget({ data, id: currentId })}
                >
                  Email invoice
                </button>
              </div>

              {status && <p className="msg msg--ok toolbarError">{status}</p>}
              {error && <p className="msg msg--error toolbarError">{error}</p>}

              <ScaledPreview data={data} remeasureKey={collapsed} />
            </div>
          </div>
        )}
      </main>

      {sendTarget && (
        <SendDialog
          data={sendTarget.data}
          onClose={() => setSendTarget(null)}
          onSent={handleSent}
        />
      )}
    </div>
  );
}
