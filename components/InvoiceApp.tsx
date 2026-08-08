'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import InvoiceForm from './InvoiceForm';
import InvoicePreview from './InvoicePreview';
import SavedList from './SavedList';
import AuthPanel from './AuthPanel';

import SendDialog from './SendDialog';

import { Invoice, defaultInvoice, nextInvoiceNo } from '@/lib/invoice';
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

const DRAFT_KEY = 'invoice-generator:draft';

export default function InvoiceApp() {
  const [data, setData] = useState<Invoice>(defaultInvoice);
  const [currentId, setCurrentId] = useState<string | null>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);

  const [saved, setSaved] = useState<SavedInvoice[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
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

  /* ------------------------------------------------------- saved list -- */

  const refresh = useCallback(async () => {
    if (!signedIn) return;
    setListLoading(true);
    setError('');
    try {
      setSaved(await listInvoices());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not load saved invoices.'
      );
    } finally {
      setListLoading(false);
    }
  }, [signedIn]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
      setError(err instanceof Error ? err.message : 'Could not save.');
    }
  };

  const handleDownloadPdf = async () => {
    setError('');
    setBusyPdf(true);
    try {
      await downloadInvoicePdf(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not build the PDF.');
    } finally {
      setBusyPdf(false);
    }
  };

  const handleSent = async (recipient: string) => {
    setSending(false);
    try {
      const id = await markSent(data, currentId, recipient);
      setCurrentId(id);
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
    setData(defaultInvoice);
    setCurrentId(null);
    flash('Started a new invoice.');
  };

  const handleLoad = (item: SavedInvoice) => {
    setData({ ...defaultInvoice, ...item.data });
    setCurrentId(item.id);
    flash(`Loaded ${item.title}.`);
  };

  const handleDuplicate = (item: SavedInvoice) => {
    const copy = { ...defaultInvoice, ...item.data };
    setData({ ...copy, invoiceNo: nextInvoiceNo(copy.invoiceNo) });
    setCurrentId(null); // saves as a new row
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
      setError(err instanceof Error ? err.message : 'Could not delete.');
    }
  };

  const handleSignOut = async () => {
    await getSupabase()?.auth.signOut();
    setSaved([]);
    setCurrentId(null);
  };

  /* ------------------------------------------------------------ views -- */

  if (!authReady) {
    return <p className="bootMsg">Loading…</p>;
  }

  if (!signedIn) {
    return <AuthPanel />;
  }

  return (
    <div className="app">
      <div className="pane pane--form">
        <h1 className="appTitle">Invoice Generator</h1>
        <p className="appSub">
          Fill in the fields — the preview updates as you type.
        </p>

        <div className="accountBar">
          <span className="badge">
            {isSupabaseConfigured
              ? `Synced · ${session?.user.email ?? ''}`
              : 'This browser only'}
          </span>
          {isSupabaseConfigured && (
            <button type="button" className="linkBtn" onClick={handleSignOut}>
              Sign out
            </button>
          )}
        </div>

        <fieldset className="fieldset">
          <legend>Saved invoices</legend>
          <SavedList
            items={saved}
            currentId={currentId}
            loading={listLoading}
            onLoad={handleLoad}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
          />
        </fieldset>

        <InvoiceForm data={data} onChange={update} />
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
          <button type="button" className="btn btn--ghost" onClick={handleNew}>
            New
          </button>

          <div className="toolbar__spacer" />

          <button
            type="button"
            className="btn btn--ghost"
            onClick={handleDownloadPdf}
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
            onClick={() => setSending(true)}
          >
            Email invoice
          </button>
        </div>

        {status && <p className="msg msg--ok toolbarError">{status}</p>}
        {error && <p className="msg msg--error toolbarError">{error}</p>}

        <InvoicePreview data={data} />
      </div>

      {sending && (
        <SendDialog
          data={data}
          onClose={() => setSending(false)}
          onSent={handleSent}
        />
      )}
    </div>
  );
}
