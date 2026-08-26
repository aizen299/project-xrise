import { cookies } from 'next/headers';
import { SESSION_TTL_SECONDS, verifySessionToken, type SessionClaims } from './jwt';
import { SESSION_COOKIE } from './session-constants';
import { isLocal } from '../runtime-mode';

export { SESSION_COOKIE };

/**
 * httpOnly, so a successful XSS still cannot read the token — which is the
 * whole reason this is not in localStorage. SameSite=Lax stops the cookie
 * riding along on cross-site form posts, which combined with JSON-only
 * mutating endpoints covers CSRF at this scale.
 */
function baseCookieOptions() {
  return {
    httpOnly: true,
    secure: !isLocal(),
    sameSite: 'lax' as const,
    path: '/',
  };
}

export function sessionCookie(token: string) {
  return { name: SESSION_COOKIE, value: token, ...baseCookieOptions(), maxAge: SESSION_TTL_SECONDS };
}

export function clearedSessionCookie() {
  return { name: SESSION_COOKIE, value: '', ...baseCookieOptions(), maxAge: 0 };
}

/** Reads and verifies the session. Note `cookies()` is async in Next.js 16. */
export async function getSession(): Promise<SessionClaims | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
