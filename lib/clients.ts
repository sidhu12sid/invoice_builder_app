'use client';

import { getSupabase } from './supabase';

export type Client = {
  id: string;
  name: string;
  address: string;
  email: string;
  phone: string;
  /** Hourly rate. Blank means bill by hand-entered amounts instead. */
  rate: string;
};

const LOCAL_KEY = 'invoice-generator:clients';

export const emptyClient = (): Client => ({
  id: '',
  name: '',
  address: '',
  email: '',
  phone: '',
  rate: '',
});

function readLocal(): Client[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const list = raw ? (JSON.parse(raw) as Client[]) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

const writeLocal = (list: Client[]) =>
  localStorage.setItem(LOCAL_KEY, JSON.stringify(list));

const newId = () =>
  globalThis.crypto?.randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;

const byName = (a: Client, b: Client) =>
  a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });

export async function listClients(): Promise<Client[]> {
  const sb = getSupabase();
  if (!sb) return readLocal().sort(byName);

  const { data, error } = await sb
    .from('clients')
    .select('id, name, address, email, phone, rate')
    .order('name');

  if (error) throw error;
  // rate arrived later than the other columns, so tolerate nulls.
  return (data ?? []).map((row) => ({ ...row, rate: row.rate ?? '' })) as Client[];
}

/** Creates when `client.id` is blank, updates otherwise. Returns the id. */
export async function saveClient(client: Client): Promise<string> {
  const sb = getSupabase();

  if (!sb) {
    const list = readLocal();
    if (client.id) {
      const idx = list.findIndex((c) => c.id === client.id);
      if (idx !== -1) {
        list[idx] = client;
        writeLocal(list);
        return client.id;
      }
    }
    const id = newId();
    list.push({ ...client, id });
    writeLocal(list);
    return id;
  }

  const { data: user } = await sb.auth.getUser();
  if (!user.user) throw new Error('Not signed in.');

  const row = {
    name: client.name,
    address: client.address,
    email: client.email,
    phone: client.phone,
    rate: client.rate,
  };

  if (client.id) {
    const { error } = await sb.from('clients').update(row).eq('id', client.id);
    if (error) throw error;
    return client.id;
  }

  const { data, error } = await sb
    .from('clients')
    .insert({ ...row, user_id: user.user.id })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

export async function deleteClient(id: string): Promise<void> {
  const sb = getSupabase();

  if (!sb) {
    writeLocal(readLocal().filter((c) => c.id !== id));
    return;
  }

  const { error } = await sb.from('clients').delete().eq('id', id);
  if (error) throw error;
}
