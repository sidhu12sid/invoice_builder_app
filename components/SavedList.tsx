'use client';

import { SavedInvoice } from '@/lib/store';
import { formatAmount, totals } from '@/lib/invoice';

type Props = {
  items: SavedInvoice[];
  selectedId: string | null;
  loading: boolean;
  onPreview: (item: SavedInvoice) => void;
  onEdit: (item: SavedInvoice) => void;
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
  selectedId,
  loading,
  onPreview,
  onEdit,
  onDuplicate,
  onDelete,
}: Props) {
  if (loading) return <p className="hint">Loading saved invoices…</p>;

  if (!items.length) {
    return (
      <p className="hint">
        Nothing saved yet. Build one under <b>Create invoice</b> and hit{' '}
        <b>Save</b>.
      </p>
    );
  }

  return (
    <ul className="saved">
      {items.map((item) => {
        const total = totals(item.data.items).price;
        return (
          <li
            key={item.id}
            className={`saved__row${
              item.id === selectedId ? ' is-current' : ''
            }`}
          >
            <button
              type="button"
              className="saved__open"
              onClick={() => onPreview(item)}
              title="Preview this invoice"
            >
              <span className="saved__title">{item.title}</span>
              <span className="saved__meta">
                <span className={`pill pill--${item.status}`}>
                  {item.status}
                </span>
                <span className="saved__date">
                  {item.status === 'sent' && item.sentAt
                    ? `sent ${when(item.sentAt)}`
                    : when(item.updatedAt)}
                </span>
                <span className="saved__amount">
                  {item.data.currency}
                  {formatAmount(total)}
                </span>
              </span>
            </button>

            <div className="saved__actions">
              <button
                type="button"
                className="btn btn--tiny"
                onClick={() => onPreview(item)}
              >
                Preview
              </button>
              <button
                type="button"
                className="btn btn--tiny"
                onClick={() => onEdit(item)}
              >
                Edit
              </button>
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
        );
      })}
    </ul>
  );
}
