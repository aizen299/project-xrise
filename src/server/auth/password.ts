import bcrypt from 'bcryptjs';

/**
 * Cost 12: ~250ms per hash on modern hardware. High enough to make offline
 * cracking expensive, low enough not to stall a serverless login handler.
 */
const BCRYPT_COST = 12;

export function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_COST);
}

export function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

/**
 * Burns roughly one bcrypt comparison against a throwaway hash.
 *
 * Called when a login attempt names an address that does not exist, so that
 * "no such user" and "wrong password" take comparable time and the endpoint
 * cannot be used to enumerate which agent accounts are real.
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.pRPKXlbGgV4YXBBHUqZ5x6Nb0hXhVFm';

export async function burnPasswordComparison(plaintext: string): Promise<void> {
  await bcrypt.compare(plaintext, DUMMY_HASH);
}
