import { NextResponse } from 'next/server';
import { route } from '@/server/http';
import { connectToDatabase } from '@/server/db/client';
import { statusLookupSchema } from '@/server/validation/schemas';
import { getPublicTicketStatus } from '@/server/services/ticket.service';
import { enforceRateLimit, POLICIES } from '@/server/ratelimit';
import { clientIp } from '@/server/client-ip';

export const runtime = 'nodejs';

export const GET = route(async (request) => {
  await connectToDatabase();
  await enforceRateLimit(`status-check:${clientIp(request)}`, POLICIES.statusCheck);

  const params = request.nextUrl.searchParams;
  const input = statusLookupSchema.parse({
    ticketId: params.get('ticketId') ?? '',
    email: params.get('email') ?? '',
  });

  return NextResponse.json({ ticket: await getPublicTicketStatus(input) });
});
