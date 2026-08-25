import { NextResponse } from 'next/server';
import { route } from '@/server/http';
import { getSession } from '@/server/auth/session';
import { requireAuth } from '@/server/auth/guards';

export const runtime = 'nodejs';

export const GET = route(async () => {
  const user = requireAuth(await getSession());
  return NextResponse.json({ user });
});
