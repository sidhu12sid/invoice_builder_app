'use client';

import { SavedInvoice } from '@/lib/store';

type Props = {
  items: SavedInvoice[];
  currentId: string | null;
  loading: boolean;
  onLoad: (item: SavedInvoice) => void;
  onDuplicate: (item: SavedInvoice) => void;
  onDelete: (item: SavedInvoice) => void;
};

const when = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      });
};

export default function SavedList({
  items,
  currentId,
  loading,
  onLoad,
  onDuplicate,
  onDelete,
}: Props) {
  if (loading) return <p className="hint">Loading saved invoices…</p>;

  if (!items.length) {
    return (
      <p className="hint">
        No saved invoices yet. Fill in the form and hit <b>Save</b>.
      </p>
    );
  }

  return (
    <ul className="saved">
      {items.map((item) => (
        <li
          key={item.id}
          className={`saved__row${item.id === currentId ? ' is-current' : ''}`}
        >
          <button
            type="button"
            className="saved__open"
            onClick={() => onLoad(item)}
            title="Load this invoice"
          >
            <span className="saved__title">{item.title}</span>
            <span className="saved__meta">
              <span className={`pill pill--${item.status}`}>{item.status}</span>
              <span className="saved__date">
                {item.status === 'sent' && item.sentAt
                  ? `sent ${when(item.sentAt)}`
                  : when(item.updatedAt)}
              </span>
            </span>
          </button>

          <div className="saved__actions">
            <button
              type="button"
              className="btn btn--tiny"
              onClick={() => onDuplicate(item)}
              title="Copy into a new invoice"
            >
              Duplicate
            </button>
            <button
              type="button"
              className="btn btn--tiny btn--danger"
              onClick={() => onDelete(item)}
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
