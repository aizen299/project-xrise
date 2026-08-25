import { NextResponse } from 'next/server';
import { route } from '@/server/http';
import { clearedSessionCookie } from '@/server/auth/session';

export const runtime = 'nodejs';

export const POST = route(async () => {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(clearedSessionCookie());
  return response;
});
