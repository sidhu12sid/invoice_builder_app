'use client';
import { getLoginSession, getSupabase } from './supabase';

export type Currency = { code: string; name: string; symbol: string };
export const defaultCurrencies: Currency[] = [{ code: 'INR', name: 'Indian rupee', symbol: '₹' }];
const KEY = 'invoice-generator:currencies';

export async function listCurrencies(): Promise<Currency[]> {
  const sb = getSupabase();
  if (!sb) {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : defaultCurrencies;
  }
  const { data, error } = await sb.from('currencies').select('code,name,symbol').order('code');
  if (error) throw error;
  return data ?? [];
}

export async function addCurrency(input: Currency) {
  const currency = { code: input.code.trim().toUpperCase(), name: input.name.trim(), symbol: input.symbol.trim() };
  if (!/^[A-Z]{3}$/.test(currency.code) || !currency.name || currency.name.length > 80 || !currency.symbol || currency.symbol.length > 12) {
    throw new Error('Enter a three-letter code, a name (up to 80 characters), and a symbol (up to 12 characters).');
  }
  const sb = getSupabase();
  if (!sb) {
    const list = await listCurrencies();
    if (list.some(c => c.code === currency.code)) throw new Error('This currency code already exists.');
    localStorage.setItem(KEY, JSON.stringify([...list, currency].sort((a,b) => a.code.localeCompare(b.code))));
    return;
  }
  const session = await getLoginSession();
  if (!session) throw new Error('Not signed in.');
  const { error } = await sb.from('currencies').insert({ ...currency, user_id: session.user.id });
  if (error) throw new Error(error.code === '23505' ? 'This currency code already exists.' : 'Could not save currency. Check the currencies migration.');
}
