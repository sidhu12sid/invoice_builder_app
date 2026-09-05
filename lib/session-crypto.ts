import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

export const REMEMBER_SECONDS = 45 * 24 * 60 * 60;
export type LoginSession = {
  purpose?: 'recovery';
  access: string;
  refresh: string;
  tokenExpires: number;
  expires: number;
  remember: boolean;
};

function key() {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret || !/^[a-f0-9]{64}$/i.test(secret)) {
    throw new Error('AUTH_SESSION_SECRET must be a 32-byte hexadecimal secret.');
  }
  return Buffer.from(secret, 'hex');
}

export function seal(session: LoginSession): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(session), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

export function unseal(value: string): LoginSession | null {
  try {
    const bytes = Buffer.from(value, 'base64url');
    const decipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const data = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
    if (!Number.isFinite(data.expires) || data.expires <= Date.now() ||
        typeof data.access !== 'string' || typeof data.refresh !== 'string' ||
        !Number.isFinite(data.tokenExpires) || typeof data.remember !== 'boolean') return null;
    return data;
  } catch { return null; }
}
