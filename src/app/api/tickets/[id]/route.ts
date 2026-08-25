import { NextResponse } from 'next/server';
import { route } from '@/server/http';
import { connectToDatabase } from '@/server/db/client';
import { getSession } from '@/server/auth/session';
import { requireRole } from '@/server/auth/guards';
import { getTicketDetail } from '@/server/services/ticket.service';

export const runtime = 'nodejs';

export const GET = route<RouteContext<'/api/tickets/[id]'>>(async (_request, context) => {
  await connectToDatabase();

  const user = requireRole(await getSession(), 'agent', 'admin');
  const { id } = await context.params;

  return NextResponse.json({ ticket: await getTicketDetail(id, user) });
});
