/**
 * Verifies that .env.local and the database schema are set up correctly.
 *   npm run check:supabase
 */
import { createClient } from '@supabase/supabase-js';

const ok = (m) => console.log(`  \x1b[32mOK\x1b[0m    ${m}`);
const bad = (m) => console.log(`  \x1b[31mFAIL\x1b[0m  ${m}`);
const info = (m) => console.log(`        ${m}`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('\nChecking Supabase setup\n');

/* -- 1. env vars ---------------------------------------------------------- */

if (!url || !key) {
  bad('Environment variables missing.');
  info('Create .env.local (copy .env.local.example) and set:');
  info('  NEXT_PUBLIC_SUPABASE_URL');
  info('  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

if (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url)) {
  bad(`URL looks wrong: ${url}`);
  info('Expected something like https://abcdefgh.supabase.co');
  info('Use the Project URL, not the dashboard address.');
  process.exit(1);
}
ok(`URL ${url}`);

const isPublishable = key.startsWith('sb_publishable_');
const isLegacyAnon = key.startsWith('eyJ');

if (key.startsWith('sb_secret_') || key.includes('service_role')) {
  bad('That is a SECRET key — it must never go in a NEXT_PUBLIC_ variable.');
  info('It ships to the browser and bypasses row-level security.');
  info('Use the publishable key instead.');
  process.exit(1);
}
if (!isPublishable && !isLegacyAnon) {
  bad('Key format not recognised.');
  info('Expected sb_publishable_... or a legacy anon JWT starting with eyJ');
  process.exit(1);
}
ok(isPublishable ? 'Publishable key' : 'Legacy anon key (deprecated end of 2026)');

/* -- 2. connectivity + schema --------------------------------------------- */

const supabase = createClient(url, key);
const { error } = await supabase.from('invoices').select('id').limit(1);

if (error) {
  if (error.code === '42P01' || /does not exist/i.test(error.message)) {
    bad('Table "invoices" not found.');
    info('Run supabase/schema.sql in the dashboard: SQL Editor → New query.');
  } else if (/Invalid API key|JWT/i.test(error.message)) {
    bad('The project rejected the key.');
    info('Re-copy it — make sure it belongs to this project.');
  } else {
    bad(`${error.message}${error.code ? ` (${error.code})` : ''}`);
  }
  process.exit(1);
}

ok('Table "invoices" reachable');

/* -- 3. RLS --------------------------------------------------------------- */

// Signed out, a correct policy yields zero rows rather than an error. Rows
// coming back here would mean the data is world-readable.
const { data: leaked } = await supabase.from('invoices').select('id').limit(1);

if (leaked && leaked.length > 0) {
  bad('Rows are readable without signing in — row-level security is OFF.');
  info('Your bank details would be public. Re-run supabase/schema.sql.');
  process.exit(1);
}
ok('Row-level security is blocking anonymous reads');

console.log('\nAll good. Run `npm run dev` and create your account.\n');
