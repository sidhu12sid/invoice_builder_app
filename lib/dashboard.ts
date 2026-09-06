import { totals, type Invoice } from './invoice';
import type { SavedInvoice } from './store';

// Symbols alone (notably $) cannot identify a currency reliably.
export function currencyKey(data: Invoice) {
  return data.currencyCode?.trim().toUpperCase() || `Unspecified (${data.currency || 'no symbol'})`;
}

export function invoiceDate(value: string): Date | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  const display = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!iso && !display) return null;
  const [y, m, d] = iso ? [+iso[1], +iso[2], +iso[3]] : [+display![3], +display![2], +display![1]];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? date : null;
}

export function summarize(items: SavedInvoice[], now = new Date()) {
  const months = Array.from({ length: 6 }, (_, i) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    return { key: `${date.getFullYear()}-${date.getMonth()}`, label: date.toLocaleDateString('en', { month: 'short', year: '2-digit' }), invoiced: 0, received: 0, billableHours: 0 };
  });
  let hours = 0, undated = 0;
  const clients = new Map<string, { name: string; amount: number; count: number }>();
  for (const item of items.filter(item => item.status !== 'draft')) {
    const total = totals(item.data.items, item.data.rate);
    const date = invoiceDate(item.data.invoiceDate);
    if (!date) undated++;
    const month = date && months.find(m => m.key === `${date.getFullYear()}-${date.getMonth()}`);
    if (month) {
      month.invoiced += total.price;
      month.billableHours += total.billableHours;
    }
    if (month === months[5]) hours += total.billableHours;
    for (const payment of item.data.payments ?? []) {
      const paid = invoiceDate(payment.date);
      const bucket = paid && months.find(m => m.key === `${paid.getFullYear()}-${paid.getMonth()}`);
      if (bucket && Number.isFinite(payment.amount) && payment.amount > 0) bucket.received += payment.amount;
    }
    const name = item.data.clientCompany.trim() || 'Unnamed client';
    const key = `${name.toLowerCase()}|${item.data.clientEmail.trim().toLowerCase()}`;
    const client = clients.get(key) ?? { name, amount: 0, count: 0 };
    client.amount += total.price; client.count++;
    clients.set(key, client);
  }
  return { months, hours, undated, total: items.length, drafts: items.filter(i => i.status === 'draft').length, clients: [...clients.values()].sort((a, b) => b.amount - a.amount).slice(0, 5) };
}
