import { SignJWT, jwtVerify } from 'jose';
import { getEnv } from '../env';
import { USER_ROLES, type UserRole } from '../../types';

/**
 * `jose` rather than `jsonwebtoken`: it is built on Web Crypto, so the same
 * verification code runs in the edge runtime that proxy.ts executes in.
 */
const ALGORITHM = 'HS256';
const ISSUER = 'xrise-helpdesk';
const AUDIENCE = 'xrise-agents';

/** Eight hours — one working day, so an agent is not logged out mid-shift. */
const TOKEN_TTL_SECONDS = 8 * 60 * 60;

export interface SessionClaims {
  /** The agent's Mongo `_id` as a string. */
  sub: string;
  role: UserRole;
  name: string;
  email: string;
}

function signingKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().JWT_SECRET);
}

export async function signSessionToken(
  claims: SessionClaims,
  ttlSeconds: number = TOKEN_TTL_SECONDS,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ role: claims.role, name: claims.name, email: claims.email })
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(claims.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSeconds)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .sign(signingKey());
}

/**
 * Returns null for every failure mode — expired, tampered, wrong secret,
 * wrong algorithm, malformed claims. Callers cannot accidentally treat a
 * rejected token as a valid session.
 */
export async function verifySessionToken(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, signingKey(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      // Pinning the algorithm prevents an "alg" confusion attack, where a
      // forged header asks for a weaker algorithm than the one we signed with.
      algorithms: [ALGORITHM],
    });

    const { sub } = payload;
    const role = payload.role as unknown;
    const name = payload.name as unknown;
    const email = payload.email as unknown;

    if (
      typeof sub !== 'string' ||
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof role !== 'string' ||
      !USER_ROLES.includes(role as UserRole)
    ) {
      return null;
    }

    return { sub, role: role as UserRole, name, email };
  } catch {
    return null;
  }
}

export const SESSION_TTL_SECONDS = TOKEN_TTL_SECONDS;
