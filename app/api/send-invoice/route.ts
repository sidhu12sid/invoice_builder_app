import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { MailError, sendInvoiceMail } from '@/lib/mailer';

export const runtime = 'nodejs';

// A hung SMTP handshake shouldn't sit there burning the platform default.
export const maxDuration = 60;

// Vercel caps a function's request body at 4.5 MB, and base64 inflates the PDF
// by ~33%. Stay under that so the user gets our message rather than an opaque
// platform 413.
const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;

type Payload = {
  to?: string;
  cc?: string;
  subject?: string;
  message?: string;
  filename?: string;
  pdfBase64?: string;
};

const bad = (message: string, status = 400) =>
  NextResponse.json({ error: message }, { status });

/**
 * When Supabase is configured the app is potentially reachable by others, so
 * a valid session is required — otherwise this route would be an open relay
 * for anyone who found the URL. Local-only installs have no auth to check.
 */
async function authorize(request: Request): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const token = request.headers.get('authorization')?.replace(/^Bearer /i, '');
  if (!token) return 'Not signed in.';

  const { data, error } = await createClient(url, anonKey).auth.getUser(token);
  if (error || !data.user) return 'Session expired — sign in again.';

  return null;
}

export async function POST(request: Request) {
  const authError = await authorize(request);
  if (authError) return bad(authError, 401);

  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return bad('Malformed request body.');
  }

  const to = body.to?.trim();
  if (!to) return bad('A recipient address is required.');
  if (!body.pdfBase64) return bad('The invoice PDF was not generated.');

  const sizeBytes = Math.floor((body.pdfBase64.length * 3) / 4);
  if (sizeBytes > MAX_ATTACHMENT_BYTES) {
    return bad('The generated PDF is too large to email.', 413);
  }

  try {
    const provider = await sendInvoiceMail({
      to,
      cc: body.cc,
      subject: body.subject?.trim() || 'Invoice',
      text: body.message ?? '',
      filename: body.filename || 'invoice.pdf',
      pdfBase64: body.pdfBase64,
    });
    return NextResponse.json({ ok: true, provider });
  } catch (err) {
    if (err instanceof MailError) return bad(err.message, err.status);
    const detail = err instanceof Error ? err.message : 'Unknown error.';
    return bad(`Could not send: ${detail}`, 502);
  }
}
