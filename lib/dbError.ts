'use client';

/**
 * Turns a Supabase/Postgres failure into something the user can act on.
 * The common one by far is a table that hasn't been created yet, because
 * schema.sql gained new tables after the project was first set up.
 */
export function describeDbError(err: unknown, what: string): string {
  const e = err as { code?: string; message?: string } | null;
  const message = e?.message ?? '';

  if (e?.code === '42P01' || /relation .* does not exist/i.test(message)) {
    return `The database has no table for ${what} yet. Run supabase/schema.sql in the Supabase SQL Editor — it's safe to re-run.`;
  }

  if (e?.code === '42703' || /column .* does not exist/i.test(message)) {
    return `The table behind ${what} is missing a column. Re-run supabase/schema.sql to bring it up to date.`;
  }

  if (e?.code === 'PGRST301' || /JWT|not authenticated/i.test(message)) {
    return 'Your session expired. Sign out and back in.';
  }

  return message || `Could not load ${what}.`;
}
