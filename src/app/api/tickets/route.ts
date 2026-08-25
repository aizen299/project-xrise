import { NextResponse } from 'next/server';
import { route, readJson } from '@/server/http';
import { connectToDatabase } from '@/server/db/client';
import { createTicketSchema } from '@/server/validation/schemas';
import { createTicket } from '@/server/services/ticket.service';
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
