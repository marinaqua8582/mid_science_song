import { scryptSync, timingSafeEqual } from 'node:crypto';

const HASH_PREFIX = 'scrypt';
const HASH_BYTES = 64;

export function isAdminPasswordConfigured(): boolean {
  return String(process.env.ADMIN_PASSWORD_HASH || '').startsWith(`${HASH_PREFIX}$`);
}

export function verifyAdminPassword(password: unknown): boolean {
  const configured = String(process.env.ADMIN_PASSWORD_HASH || '');
  const [prefix, salt, expectedHash, extra] = configured.split('$');
  if (prefix !== HASH_PREFIX || !salt || !expectedHash || extra) return false;

  try {
    const actual = scryptSync(String(password || ''), Buffer.from(salt, 'base64url'), HASH_BYTES);
    const expected = Buffer.from(expectedHash, 'base64url');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
