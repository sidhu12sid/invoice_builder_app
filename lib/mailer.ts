/**
 * Server-side email sending. Three interchangeable providers, picked from
 * whichever environment variables are present — so switching provider is a
 * config change, never a code change.
 *
 * HTTP providers (Resend, Brevo) are the better fit for serverless: no socket
 * to keep open, no cold-start handshake, and nothing that breaks when
 * Microsoft retires basic auth for SMTP.
 */

export type MailInput = {
  to: string;
  cc?: string;
  subject: string;
  text: string;
  filename: string;
  pdfBase64: string;
};

export type Provider = 'resend' | 'brevo' | 'smtp';

export class MailError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

/** Explicit EMAIL_PROVIDER wins; otherwise the first configured one. */
export function detectProvider(): Provider | null {
  const explicit = process.env.EMAIL_PROVIDER?.trim().toLowerCase();
  if (explicit === 'resend' || explicit === 'brevo' || explicit === 'smtp') {
    return explicit;
  }
  if (process.env.RESEND_API_KEY) return 'resend';
  if (process.env.BREVO_API_KEY) return 'brevo';
  if (process.env.SMTP_HOST) return 'smtp';
  return null;
}

function senderAddress(): string {
  const from =
    process.env.MAIL_FROM || process.env.SMTP_FROM || process.env.SMTP_USER;
  if (!from) {
    throw new MailError(
      'No sender address. Set MAIL_FROM in your environment.',
      501
    );
  }
  return from;
}

/** Splits `Name <a@b.com>` into its parts; bare addresses pass through. */
function parseSender(value: string): { email: string; name?: string } {
  const match = value.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return match
    ? { name: match[1].replace(/^"|"$/g, '') || undefined, email: match[2] }
    : { email: value.trim() };
}

const splitList = (value?: string) =>
  (value ?? '')
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);

/* ---------------------------------------------------------------- resend -- */

async function sendViaResend(mail: MailInput) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new MailError('RESEND_API_KEY is not set.', 501);

  const cc = splitList(mail.cc);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: senderAddress(),
      to: [mail.to],
      ...(cc.length ? { cc } : {}),
      subject: mail.subject,
      text: mail.text,
      attachments: [{ filename: mail.filename, content: mail.pdfBase64 }],
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body.message ?? body.error ?? `HTTP ${res.status}`;
    // The most common first-run failure, and the message alone doesn't say it.
    const hint =
      res.status === 403 || /domain is not verified|testing emails/i.test(String(detail))
        ? ' — verify your sending domain in Resend; the shared resend.dev sender can only reach your own account address.'
        : '';
    throw new MailError(`Resend: ${detail}${hint}`);
  }
}

/* ----------------------------------------------------------------- brevo -- */

async function sendViaBrevo(mail: MailInput) {
  const key = process.env.BREVO_API_KEY;
  if (!key) throw new MailError('BREVO_API_KEY is not set.', 501);

  const sender = parseSender(senderAddress());
  const cc = splitList(mail.cc).map((email) => ({ email }));

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': key,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: [{ email: mail.to }],
      ...(cc.length ? { cc } : {}),
      subject: mail.subject,
      textContent: mail.text,
      attachment: [{ name: mail.filename, content: mail.pdfBase64 }],
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body.message ?? `HTTP ${res.status}`;
    const hint = /sender/i.test(String(detail))
      ? ' — the sender address must be verified in Brevo under Senders, Domains & Dedicated IPs.'
      : '';
    throw new MailError(`Brevo: ${detail}${hint}`);
  }
}

/* ------------------------------------------------------------------ smtp -- */

async function sendViaSmtp(mail: MailInput) {
  const { host, port, user, pass } = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  };

  if (!host || !port || !user || !pass) {
    throw new MailError(
      'SMTP is incomplete. Set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS.',
      501
    );
  }

  // Imported here so the Node-only dependency isn't pulled in when an HTTP
  // provider is doing the work.
  const nodemailer = (await import('nodemailer')).default;
  const portNumber = Number(port);

  const transporter = nodemailer.createTransport({
    host,
    port: portNumber,
    // 465 is implicit TLS; 587 upgrades via STARTTLS.
    secure: process.env.SMTP_SECURE
      ? process.env.SMTP_SECURE === 'true'
      : portNumber === 465,
    auth: { user, pass },
    // Fail with a readable message instead of hanging until the function is
    // killed — serverless has no one watching a stuck socket.
    connectionTimeout: 15_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  try {
    await transporter.sendMail({
      from: senderAddress(),
      to: mail.to,
      cc: mail.cc?.trim() || undefined,
      subject: mail.subject,
      text: mail.text,
      attachments: [
        {
          filename: mail.filename,
          content: Buffer.from(mail.pdfBase64, 'base64'),
          contentType: 'application/pdf',
        },
      ],
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'Unknown SMTP error.';
    throw new MailError(`SMTP: ${detail}`);
  }
}

/* ---------------------------------------------------------------- public -- */

export async function sendInvoiceMail(mail: MailInput): Promise<Provider> {
  const provider = detectProvider();

  if (!provider) {
    throw new MailError(
      'Email is not configured. Set RESEND_API_KEY, BREVO_API_KEY, or the SMTP_* variables, then redeploy or restart.',
      501
    );
  }

  if (provider === 'resend') await sendViaResend(mail);
  else if (provider === 'brevo') await sendViaBrevo(mail);
  else await sendViaSmtp(mail);

  return provider;
}
