'use client';

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Statically referenced so Next.js can inline them at build time.
// Either key format works: the new `sb_publishable_...` key or the legacy
// `anon` JWT, which Supabase deprecates at the end of 2026.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/** Returns the shared client, or null when the app is running local-only. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
  }
  return client;
}
