import { NextResponse } from 'next/server';
import { route } from '@/server/http';
import { connectToDatabase } from '@/server/db/client';
import { getSession } from '@/server/auth/session';
import { requireRole } from '@/server/auth/guards';
import { draftReply } from '@/server/services/ai.service';
import { enforceRateLimit } from '@/server/ratelimit';

export const runtime = 'nodejs';
export const maxDuration = 30;

export const POST = route<RouteContext<'/api/tickets/[id]/draft'>>(async (_request, context) => {
  await connectToDatabase();

  const user = requireRole(await getSession(), 'agent', 'admin');
  await enforceRateLimit(`ai-draft:${user.sub}`, { limit: 20, windowSeconds: 600 });

  const { id } = await context.params;

  return NextResponse.json({ draft: await draftReply(id, user) });
});
