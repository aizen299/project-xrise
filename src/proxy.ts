import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionToken } from './server/auth/jwt';
import { SESSION_COOKIE } from './server/auth/session-constants';

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (session) return NextResponse.next();

  const loginUrl = new URL('/login', request.url);

  loginUrl.searchParams.set('next', request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/dashboard/:path*', '/tickets/:path*'],
};
