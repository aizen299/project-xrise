import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionToken } from './server/auth/jwt';
import { SESSION_COOKIE } from './server/auth/session-constants';

/**
 * `proxy` is the Next.js 16 replacement for the deprecated `middleware`
 * convention. It runs before rendering and is a FAST REJECT ONLY — never the
 * security boundary. Next's own guidance is that proxy may be deployed to a
 * CDN and must not rely on shared modules or globals, so every Route Handler
 * re-derives the session independently and every query re-applies its scope.
 *
 * It deliberately guards pages only, not /api/*. The API surface mixes public
 * and protected routes on the same path — POST /api/tickets is the public
 * submission endpoint while GET /api/tickets is the agent list — so a
 * path-prefix rule here would either block the public form or wave the agent
 * list through. Authorization for the API lives with the handlers, which is
 * where it has to be regardless.
 */
export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (session) return NextResponse.next();

  const loginUrl = new URL('/login', request.url);
  // Send the agent back where they were headed once they authenticate.
  loginUrl.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/dashboard/:path*', '/tickets/:path*'],
};
