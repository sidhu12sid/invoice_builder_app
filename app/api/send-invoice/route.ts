import { NextResponse } from 'next/server';
import { readSession } from '@/lib/auth-server';
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

/** Email requires a verified, active account and a same-origin session. */
async function authorize(request: Request): Promise<string | null> {
  if (request.headers.get('origin') !== new URL(request.url).origin) return 'Invalid request origin.';
  try { return await readSession(true) ? null : 'Session expired — sign in again.'; }
  catch { return 'Authentication is unavailable.'; }
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
