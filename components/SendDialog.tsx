'use client';

import { useEffect, useState } from 'react';
import { Invoice, formatAmount, totals } from '@/lib/invoice';
import { blobToBase64, pdfFilename, renderInvoicePdf } from '@/lib/pdf';
import { getSupabase } from '@/lib/supabase';

type Props = {
  data: Invoice;
  onClose: () => void;
  onSent: (recipient: string) => void;
};

export default function SendDialog({ data, onClose, onSent }: Props) {
  const [to, setTo] = useState(data.clientEmail);
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const no = data.invoiceNo.trim();
    const period = data.invoicePeriod.trim();
    const who = data.senderName.trim();
    const amount = `${data.currency}${formatAmount(totals(data.items).price)}`;

    setSubject(
      ['Invoice', no && `#${no}`, period && `— ${period}`]
        .filter(Boolean)
        .join(' ')
    );

    setMessage(
      [
        `Hi,`,
        ``,
        `Please find attached invoice${no ? ` #${no}` : ''}${
          period ? ` for ${period}` : ''
        }, totalling ${amount}.`,
        ``,
        `Thanks,`,
        who || '',
      ].join('\n')
    );
    // Only seeds the fields when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const blob = await renderInvoicePdf();
      const pdfBase64 = await blobToBase64(blob);

      const token = (await getSupabase()?.auth.getSession())?.data.session
        ?.access_token;

      const res = await fetch('/api/send-invoice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          to,
          cc,
          subject,
          message,
          filename: pdfFilename(data),
          pdfBase64,
        }),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status}).`);

      onSent(to.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="modalBackdrop"
      onClick={(e) => e.target === e.currentTarget && !busy && onClose()}
    >
      <form className="modal" onSubmit={send}>
        <h2 className="modal__title">Email this invoice</h2>
        <p className="hint">
          The invoice is attached as a PDF, generated from the preview.
        </p>

        <label className="field">
          <span>To</span>
          <input
            type="email"
            required
            value={to}
            placeholder="accounts@client.com"
            onChange={(e) => setTo(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Cc (optional)</span>
          <input
            type="text"
            value={cc}
            placeholder="you@yourcompany.com"
            onChange={(e) => setCc(e.target.value)}
          />
        </label>

        <label className="field">
          <span>Subject</span>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} />
        </label>

        <label className="field">
          <span>Message</span>
          <textarea
            rows={7}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>

        {error && <p className="msg msg--error">{error}</p>}

        <div className="modal__actions">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Send invoice'}
          </button>
        </div>
      </form>
    </div>
  );
}
