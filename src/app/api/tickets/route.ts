import { NextResponse } from 'next/server';
import { route, readJson } from '@/server/http';
import { connectToDatabase } from '@/server/db/client';
import { createTicketSchema, parseTicketListQuery } from '@/server/validation/schemas';
import { createTicket, listTickets } from '@/server/services/ticket.service';
import { getSession } from '@/server/auth/session';
import { requireRole } from '@/server/auth/guards';
import { enforceRateLimit, POLICIES } from '@/server/ratelimit';
import { clientIp } from '@/server/client-ip';

export const runtime = 'nodejs';


export const POST = route(async (request) => {
  await connectToDatabase();
  await enforceRateLimit(`ticket-create:${clientIp(request)}`, POLICIES.ticketCreate);

  const input = createTicketSchema.parse(await readJson(request));
  const { ticketId } = await createTicket(input);

  return NextResponse.json({ ticketId }, { status: 201 });
});

export const GET = route(async (request) => {
  await connectToDatabase();

  const user = requireRole(await getSession(), 'agent', 'admin');
  const query = parseTicketListQuery(request.nextUrl.searchParams);

  return NextResponse.json(await listTickets(user, query));
});
