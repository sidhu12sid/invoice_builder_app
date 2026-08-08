'use client';

import { Invoice } from './invoice';
import { getSupabase, isSupabaseConfigured } from './supabase';

export type InvoiceStatus = 'draft' | 'final' | 'sent';

export type SavedInvoice = {
  id: string;
  title: string;
  status: InvoiceStatus;
  data: Invoice;
  updatedAt: string;
  sentAt: string | null;
  sentTo: string | null;
};

const LOCAL_LIST_KEY = 'invoice-generator:saved';

/** A readable name for the sidebar, derived from whatever's been filled in. */
export function deriveTitle(data: Invoice): string {
  const no = data.invoiceNo.trim();
  const client = data.clientCompany.trim();
  const period = data.invoicePeriod.trim();
  const parts = [no && `#${no}`, client || period].filter(Boolean);
  return parts.length ? parts.join(' — ') : 'Untitled invoice';
}

/* ------------------------------------------------------------ local ----- */

function readLocal(): SavedInvoice[] {
  try {
    const raw = localStorage.getItem(LOCAL_LIST_KEY);
    const list = raw ? (JSON.parse(raw) as SavedInvoice[]) : [];
    if (!Array.isArray(list)) return [];
    // Rows written before drafts existed have no status.
    return list.map((x) => ({
      ...x,
      status: x.status ?? 'final',
      sentAt: x.sentAt ?? null,
      sentTo: x.sentTo ?? null,
    }));
  } catch {
    return [];
  }
}

function writeLocal(list: SavedInvoice[]) {
  localStorage.setItem(LOCAL_LIST_KEY, JSON.stringify(list));
}

function newLocalId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

/* ----------------------------------------------------------- public ----- */

export async function listInvoices(): Promise<SavedInvoice[]> {
  const sb = getSupabase();
  if (!sb) {
    return readLocal().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  const { data, error } = await sb
    .from('invoices')
    .select('id, title, status, data, updated_at, sent_at, sent_to')
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    status: (row.status ?? 'draft') as InvoiceStatus,
    data: row.data as Invoice,
    updatedAt: row.updated_at as string,
    sentAt: (row.sent_at as string | null) ?? null,
    sentTo: (row.sent_to as string | null) ?? null,
  }));
}

/** Creates a new row, or updates `id` when supplied. Returns the saved id. */
export async function saveInvoice(
  data: Invoice,
  id: string | null | undefined,
  status: InvoiceStatus
): Promise<string> {
  const title = deriveTitle(data);
  const sb = getSupabase();

  if (!sb) {
    const list = readLocal();
    const now = new Date().toISOString();

    if (id) {
      const idx = list.findIndex((x) => x.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], title, data, status, updatedAt: now };
        writeLocal(list);
        return id;
      }
    }

    const newId = newLocalId();
    list.push({
      id: newId,
      title,
      status,
      data,
      updatedAt: now,
      sentAt: null,
      sentTo: null,
    });
    writeLocal(list);
    return newId;
  }

  const { data: user } = await sb.auth.getUser();
  if (!user.user) throw new Error('Not signed in.');

  if (id) {
    const { error } = await sb
      .from('invoices')
      .update({ title, data, status })
      .eq('id', id);
    if (error) throw error;
    return id;
  }

  const { data: row, error } = await sb
    .from('invoices')
    .insert({ title, data, status, user_id: user.user.id })
    .select('id')
    .single();

  if (error) throw error;
  return row.id as string;
}

/** Records a successful send. Saves the invoice first if it's never been saved. */
export async function markSent(
  data: Invoice,
  id: string | null | undefined,
  recipient: string
): Promise<string> {
  const savedId = id ?? (await saveInvoice(data, null, 'sent'));
  const now = new Date().toISOString();
  const sb = getSupabase();

  if (!sb) {
    const list = readLocal();
    const idx = list.findIndex((x) => x.id === savedId);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        data,
        status: 'sent',
        sentAt: now,
        sentTo: recipient,
        updatedAt: now,
      };
      writeLocal(list);
    }
    return savedId;
  }

  const { error } = await sb
    .from('invoices')
    .update({ data, status: 'sent', sent_at: now, sent_to: recipient })
    .eq('id', savedId);

  if (error) throw error;
  return savedId;
}

export async function deleteInvoice(id: string): Promise<void> {
  const sb = getSupabase();

  if (!sb) {
    writeLocal(readLocal().filter((x) => x.id !== id));
    return;
  }

  const { error } = await sb.from('invoices').delete().eq('id', id);
  if (error) throw error;
}

export { isSupabaseConfigured };
