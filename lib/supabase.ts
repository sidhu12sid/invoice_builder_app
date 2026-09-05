'use client';

import { createClient, SupabaseClient, type User } from '@supabase/supabase-js';

// Statically referenced so Next.js can inline them at build time.
// Accept both publishable and legacy anon keys; neither is a server secret.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;
let pending: Promise<{ user: User; access_token: string } | null> | null = null;

export async function getLoginSession() {
  if (!pending) pending = fetch('/api/auth/session', { cache: 'no-store' }).then(async (response) => {
    if (response.status === 401) return null;
    if (!response.ok) throw new Error('Authentication is unavailable. Check the user migration and server configuration.');
    return response.json() as Promise<{ user: User; access_token: string }>;
  }).finally(() => { pending = null; });
  return pending;
}

/** Returns the shared client, or null when the app is running local-only. */
export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url!, anonKey!, {
      accessToken: async () => {
        const session = await getLoginSession();
        if (!session) { window.location.replace('/login'); throw new Error('Not signed in.'); }
        return session.access_token;
      },
    });
  }
  return client;
}
