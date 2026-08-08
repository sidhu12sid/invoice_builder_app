'use client';

import SavedList from './SavedList';
import ScaledPreview from './ScaledPreview';
import { SavedInvoice } from '@/lib/store';

type Props = {
  items: SavedInvoice[];
  loading: boolean;
  selected: SavedInvoice | null;
  collapsed: boolean;
  busyPdf: boolean;
  status: string;
  error: string;
  onSelect: (item: SavedInvoice) => void;
  onEdit: (item: SavedInvoice) => void;
  onDuplicate: (item: SavedInvoice) => void;
  onDelete: (item: SavedInvoice) => void;
  onPrint: () => void;
  onDownloadPdf: () => void;
  onEmail: () => void;
};

export default function SavedInvoicesView({
  items,
  loading,
  selected,
  collapsed,
  busyPdf,
  status,
  error,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  onPrint,
  onDownloadPdf,
  onEmail,
}: Props) {
  return (
    <div className="page page--wide">
      <header className="page__head">
        <h1 className="page__title">Saved invoices</h1>
        <p className="page__sub">
          Pick one to preview it, then print, download it as a PDF, or email it
          to the client.
        </p>
      </header>

      <div className="savedLayout">
        <div className="card savedLayout__list">
          <h2 className="card__title">
            All invoices{items.length ? ` (${items.length})` : ''}
          </h2>
          <SavedList
            items={items}
            selectedId={selected?.id ?? null}
            loading={loading}
            onPreview={onSelect}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        </div>

        <div className="savedLayout__preview">
          {!selected ? (
            <div className="card savedEmpty">
              <p className="hint">
                {items.length
                  ? 'Select an invoice on the left to preview it here.'
                  : 'Once you save an invoice it will show up here.'}
              </p>
            </div>
          ) : (
            <>
              <div className="toolbar">
                <span className="previewLabel">{selected.title}</span>
                <div className="toolbar__spacer" />
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={onDownloadPdf}
                  disabled={busyPdf}
                >
                  {busyPdf ? 'Building…' : 'Download PDF'}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={onPrint}
                >
                  Print
                </button>
                <button type="button" className="btn" onClick={onEmail}>
                  Email invoice
                </button>
              </div>

              {status && <p className="msg msg--ok toolbarError">{status}</p>}
              {error && <p className="msg msg--error toolbarError">{error}</p>}

              <ScaledPreview
                data={selected.data}
                remeasureKey={`${collapsed}-${selected.id}`}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
