'use client';

import { useState, type FormEvent } from 'react';
import type { SavedInvoice } from '@/lib/store';
import { formatAmount, formatHours, totals, type Invoice } from '@/lib/invoice';
import { currencyKey, invoiceDate, summarize } from '@/lib/dashboard';

type Payment = NonNullable<Invoice['payments']>[number];
type Props = { items: SavedInvoice[]; loading: boolean; error: string; onCreate: () => void; onClients: () => void; onSaved: () => void; onPayment: (item: SavedInvoice, payment: Payment) => Promise<void> };

export default function DashboardView({ items, loading, error, onCreate, onClients, onSaved, onPayment }: Props) {
  const [filter, setFilter] = useState('all');
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const currencies = [...new Set(items.map(i => currencyKey(i.data)))].sort();
  const selected = filter === 'all' ? currencies : currencies.filter(c => c === filter);
  const filtered = items.filter(i => filter === 'all' || currencyKey(i.data) === filter);
  const summary = summarize(filtered);
  const maxHours = Math.max(1, ...summary.months.map(m => m.billableHours));
  const groups = selected.map(currency => ({ currency, ...summarize(items.filter(i => currencyKey(i.data) === currency)) }));

  async function record(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const item = items.find(i => i.id === fields.get('invoice') && i.status !== 'draft');
    const amount = Number(fields.get('amount'));
    const date = String(fields.get('date'));
    const parsedDate = invoiceDate(date);
    const remaining = item ? totals(item.data.items, item.data.rate).price - (item.data.payments ?? []).reduce((sum, p) => sum + p.amount, 0) : 0;
    setPaymentError(''); setMessage('');
    if (!item || !Number.isFinite(amount) || amount <= 0 || amount > Math.round(remaining * 100) / 100 || !parsedDate || parsedDate > new Date()) {
      setPaymentError('Choose a finalized invoice, a valid payment date, and an amount within its unpaid balance.'); return;
    }
    setBusy(true);
    try {
      await onPayment(item, { id: crypto.randomUUID(), date, amount });
      form.reset(); setMessage('Payment recorded. Your trend has been updated.');
    } catch { setPaymentError('Could not save the payment. Please try again.'); }
    finally { setBusy(false); }
  }

  return <div className="dashboard">
    <header className="dashboardHeader"><div><p className="workspaceEyebrow">YOUR BUSINESS, AT A GLANCE</p><h1>Dashboard</h1><p>A little clarity for your next big move.</p></div><label className="dashboardFilter">Currency<select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All currencies · separate totals</option>{currencies.map(c => <option key={c}>{c}</option>)}</select></label></header>
    <section className="dashboardWelcome"><div><span>MAKE ROOM FOR GREAT WORK</span><h2>Less admin. More momentum.</h2><p>Your invoices, hours, and client relationships in one place.</p></div><button className="btn" onClick={onCreate}>Create an invoice <span aria-hidden="true">↗</span></button></section>
    {error ? <p className="msg msg--error" role="alert">{error}</p> : loading ? <p role="status">Loading your dashboard…</p> : <>
      <section className="dashboardMetrics" aria-label="Invoice metrics">
        <article className="dashboardMetric"><span>Invoiced this month</span><div className="dashboardMoney">{groups.length ? groups.map(g => <div key={g.currency}><small>{g.currency}</small><strong>{formatAmount(g.months[5].invoiced)}</strong></div>) : <strong>—</strong>}</div><p>Finalized and sent invoices</p></article>
        <article className="dashboardMetric"><span>Total invoices</span><strong>{summary.total}</strong><p>All saved invoices, including drafts</p></article>
        <article className="dashboardMetric"><span>Billable hours</span><strong>{formatHours(summary.hours)} <small>hrs</small></strong><p>This month · finalized and sent</p></article>
        <article className="dashboardMetric"><span>Draft invoices</span><strong>{summary.drafts}</strong><p>Saved work waiting to be finalized</p></article>
      </section>
      {!items.length && <div className="dashboardCard dashboardEmpty"><h2>Your story starts with an invoice.</h2><p>Save your first invoice to see totals, trends, and your top clients here.</p><button className="btn" onClick={onCreate}>Create an invoice</button></div>}
      {summary.undated > 0 && <p className="dashboardNote">{summary.undated} finalized invoice(s) have missing or invalid dates and are excluded from monthly metrics. Use DD/MM/YYYY or YYYY-MM-DD.</p>}
      <section className="dashboardCard dashboardHours" aria-label="Monthly billable hours">
        <div className="dashboardCardHeading"><div><h2>Monthly billable hours</h2><p>Last six months · {filter === 'all' ? 'All currencies' : filter} · current month so far</p></div><span className="dashboardCurrency">{formatHours(summary.months.reduce((sum, m) => sum + m.billableHours, 0))} hrs total</span></div>
        <div className="dashboardChart" aria-hidden="true">{summary.months.map(m => <div className="dashboardMonth" key={m.key}><div className="dashboardBars"><div title={`${m.label}: ${formatHours(m.billableHours)} hrs`} style={{ height: `${Math.max(0, m.billableHours) / maxHours * 100}%` }} /></div><span>{m.label}</span></div>)}</div>
        <div className="dashboardTableWrap"><table className="dashboardTable"><caption className="dashboardNote">Billable hours from finalized and sent invoices, grouped by invoice date. Drafts are excluded.</caption><thead><tr><th>Month</th>{summary.months.map(m => <th key={m.key}>{m.label}</th>)}</tr></thead><tbody><tr><th>Billable hours</th>{summary.months.map(m => <td key={m.key}>{formatHours(m.billableHours)} hrs</td>)}</tr></tbody></table></div>
      </section>
      {groups.map(g => {
        const max = Math.max(1, ...g.months.flatMap(m => [m.invoiced, m.received]));
        return <section className="dashboardColumns" key={g.currency} aria-label={`${g.currency} breakdown`}>
          <article className="dashboardCard"><div className="dashboardCardHeading"><div><h2>Monthly trend</h2><p>Last six months · {g.currency}</p></div><span className="dashboardCurrency">{g.currency}</span></div>
            <div className="dashboardLegend"><span>● Invoiced</span><span>● Payments received</span></div>
            <div className="dashboardChart" aria-hidden="true">{g.months.map(m => <div className="dashboardMonth" key={m.key}><div className="dashboardBars"><div title={`Invoiced: ${formatAmount(m.invoiced)}`} style={{ height: `${Math.max(0, m.invoiced) / max * 100}%` }} /><div title={`Received: ${formatAmount(m.received)}`} style={{ height: `${m.received / max * 100}%` }} /></div><span>{m.label}</span></div>)}</div>
            <div className="dashboardTableWrap"><table className="dashboardTable"><caption className="dashboardNote">Amounts in {g.currency}. Payments are grouped by receipt date.</caption><thead><tr><th>Month</th>{g.months.map(m => <th key={m.key}>{m.label}</th>)}</tr></thead><tbody><tr><th>Invoiced</th>{g.months.map(m => <td key={m.key}>{formatAmount(m.invoiced)}</td>)}</tr><tr><th>Received</th>{g.months.map(m => <td key={m.key}>{formatAmount(m.received)}</td>)}</tr></tbody></table></div>
          </article>
          <article className="dashboardCard"><div className="dashboardCardHeading"><div><h2>Top clients</h2><p>All-time invoiced value · {g.currency}</p></div></div>{g.clients.length ? <ol className="dashboardClients">{g.clients.map((client, index) => <li key={index}><span className="dashboardRank">{index + 1}</span><div><strong>{client.name}</strong><small>{client.count} invoice{client.count === 1 ? '' : 's'}</small></div><b>{formatAmount(client.amount)}</b></li>)}</ol> : <p className="dashboardNote">Finalize an invoice to see your top clients.</p>}</article>
        </section>;
      })}
    </>}
    <section className="dashboardCard"><div className="dashboardCardHeading"><div><h2>Quick actions</h2><p>Keep your business moving.</p></div></div><div className="dashboardActions"><button onClick={onCreate}>Create an invoice <span>↗</span></button><button onClick={onClients}>Add a client <span>＋</span></button><button onClick={onSaved}>View saved invoices <span>→</span></button><button onClick={() => setRecording(!recording)} aria-expanded={recording}>Record payment <span>＋</span></button></div>
      {recording && <form className="dashboardPayment" onSubmit={record}><p>Record a payment received in the invoice’s currency. Partial payments are supported.</p><fieldset disabled={busy || loading || Boolean(error)}><label className="field"><span>Invoice</span><select name="invoice" required defaultValue=""><option value="" disabled>Select an invoice</option>{items.filter(i => i.status !== 'draft').map(i => <option value={i.id} key={i.id}>{i.title} · {currencyKey(i.data)} · Balance {formatAmount(totals(i.data.items, i.data.rate).price - (i.data.payments ?? []).reduce((sum, p) => sum + p.amount, 0))}</option>)}</select></label><label className="field"><span>Amount received</span><input name="amount" type="number" required min="0.01" step="0.01" /></label><label className="field"><span>Payment date</span><input name="date" type="date" required /></label><button className="btn" disabled={busy}>{busy ? 'Saving…' : 'Save payment'}</button></fieldset>{paymentError && <p role="alert" className="msg msg--error">{paymentError}</p>}{message && <p role="status" className="msg msg--ok">{message}</p>}</form>}
    </section>
    <p className="dashboardNote">Currencies are never combined or converted. Older invoices without a currency code are shown separately. Received amounts reflect recorded payments, not email delivery.</p>
  </div>;
}
