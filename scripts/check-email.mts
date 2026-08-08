/**
 * Verifies email configuration, and optionally sends a real test message.
 *
 *   npm run check:email
 *   npm run check:email -- --send you@yourdomain.com
 *
 * Imports lib/mailer.ts directly, so a passing --send proves the exact code
 * path the app uses — not a reimplementation of it.
 */
import { detectProvider, sendInvoiceMail, MailError } from '../lib/mailer.ts';

const ok = (m: string) => console.log(`  \x1b[32mOK\x1b[0m    ${m}`);
const bad = (m: string) => console.log(`  \x1b[31mFAIL\x1b[0m  ${m}`);
const warn = (m: string) => console.log(`  \x1b[33mWARN\x1b[0m  ${m}`);
const info = (m: string) => console.log(`        ${m}`);

const argv = process.argv.slice(2);
const sendIndex = argv.indexOf('--send');
const sendTo = sendIndex !== -1 ? argv[sendIndex + 1] : null;

console.log('\nChecking email setup\n');

/* -- 1. provider ---------------------------------------------------------- */

const provider = detectProvider();

if (!provider) {
  bad('No email provider configured.');
  info('Set one of these in .env.local, then re-run:');
  info('  RESEND_API_KEY=re_...      (recommended)');
  info('  BREVO_API_KEY=xkeysib-...');
  info('  SMTP_HOST=... SMTP_PORT=... SMTP_USER=... SMTP_PASS=...');
  process.exit(1);
}
ok(`Provider: ${provider}`);

/* -- 2. sender ------------------------------------------------------------ */

const rawFrom =
  process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;

if (!rawFrom) {
  bad('MAIL_FROM is not set.');
  info('Example: MAIL_FROM=Your Name <invoices@yourdomain.com>');
  process.exit(1);
}

const fromMatch = rawFrom.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
const fromEmail = (fromMatch ? fromMatch[2] : rawFrom).trim();

if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fromEmail)) {
  bad(`MAIL_FROM doesn't contain a valid address: ${rawFrom}`);
  info('Use either you@domain.com or Your Name <you@domain.com>');
  process.exit(1);
}
ok(`Sender: ${rawFrom}`);

const fromDomain = fromEmail.split('@')[1].toLowerCase();

/* -- 3. provider-specific checks ------------------------------------------ */

if (provider === 'resend') {
  const key = process.env.RESEND_API_KEY!;

  if (!key.startsWith('re_')) {
    warn('API key does not start with "re_" — check you copied the right value.');
  }

  const res = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${key}` },
  });

  if (!res.ok) {
    // Resend answers a malformed key with 400, not 401, so go by its message.
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    const detail = body.message ?? `HTTP ${res.status}`;
    bad(`Resend rejected the request: ${detail}`);
    if (/api key|unauthor/i.test(detail) || res.status === 401 || res.status === 403) {
      info('Create a new key at resend.com → API Keys, with sending permission.');
    }
    process.exit(1);
  }

  const body = (await res.json()) as { data?: unknown };
  const domains = (Array.isArray(body) ? body : (body.data ?? [])) as Array<{
    name?: string;
    status?: string;
  }>;

  ok('API key accepted');

  if (domains.length === 0) {
    bad('No domains added to this Resend account.');
    info('resend.com → Domains → Add Domain, then add the DNS records shown.');
    info('Until a domain is verified you can only email your own signup address.');
    process.exit(1);
  }

  const match = domains.find((d) => d.name?.toLowerCase() === fromDomain);

  if (!match) {
    bad(`"${fromDomain}" is not in this Resend account.`);
    info(`Domains present: ${domains.map((d) => d.name).join(', ')}`);
    info('MAIL_FROM must use a domain you added to Resend.');
    process.exit(1);
  }

  if (match.status !== 'verified') {
    bad(`Domain "${fromDomain}" status is "${match.status}", not "verified".`);
    info('Add the DNS records Resend shows, then press Verify.');
    info('DNS can take a few minutes to propagate; re-run this after.');
    process.exit(1);
  }

  ok(`Domain "${fromDomain}" is verified`);
}

if (provider === 'brevo') {
  const res = await fetch('https://api.brevo.com/v3/senders', {
    headers: { 'api-key': process.env.BREVO_API_KEY!, Accept: 'application/json' },
  });

  if (!res.ok) {
    bad(`Brevo rejected the API key (HTTP ${res.status}).`);
    process.exit(1);
  }
  ok('API key accepted');

  const body = (await res.json()) as { senders?: Array<{ email?: string; active?: boolean }> };
  const sender = body.senders?.find(
    (s) => s.email?.toLowerCase() === fromEmail.toLowerCase()
  );

  if (!sender) {
    bad(`"${fromEmail}" is not a verified sender in Brevo.`);
    info('Brevo → Senders, Domains & Dedicated IPs → Add a Sender.');
    process.exit(1);
  }
  ok(`Sender "${fromEmail}" is registered`);
}

if (provider === 'smtp') {
  info('SMTP settings can only be proven by sending — use --send.');
}

/* -- 4. optional live send ------------------------------------------------ */

if (!sendTo) {
  console.log('\nConfig looks good. Send a real test with:');
  console.log(`  npm run check:email -- --send you@${fromDomain}\n`);
  process.exit(0);
}

// Small but structurally complete PDF, so the attachment path is exercised.
const testPdf = Buffer.from(
  `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 300 120] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 58 >>
stream
BT /F1 14 Tf 20 60 Td (Invoice mailer test) Tj ET
endstream
endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
trailer << /Root 1 0 R /Size 6 >>
%%EOF`
).toString('base64');

console.log(`\n  sending to ${sendTo} …`);

try {
  const used = await sendInvoiceMail({
    to: sendTo,
    subject: 'Invoice generator — test message',
    text:
      'If you are reading this, the invoice app can send email.\n\n' +
      'The attachment is a placeholder, not a real invoice.',
    filename: 'mailer-test.pdf',
    pdfBase64: testPdf,
  });
  ok(`Sent via ${used}. Check the inbox (and the spam folder).`);
  console.log();
} catch (err) {
  const e = err as MailError;
  bad(e.message);
  if (/domain is not verified|testing emails|403/i.test(e.message)) {
    info('Resend only allows arbitrary recipients from a verified domain.');
  }
  console.log();
  process.exit(1);
}
