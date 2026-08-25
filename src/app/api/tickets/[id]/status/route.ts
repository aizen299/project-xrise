import { NextResponse } from 'next/server';
import { readJson, route } from '@/server/http';
import { connectToDatabase } from '@/server/db/client';
import { getSession } from '@/server/auth/session';
import { requireRole } from '@/server/auth/guards';
import { statusChangeSchema } from '@/server/validation/schemas';
import { changeTicketStatus } from '@/server/services/ticket.service';

export const runtime = 'nodejs';

export const PATCH = route<RouteContext<'/api/tickets/[id]/status'>>(
  async (request, context) => {
    await connectToDatabase();

    const user = requireRole(await getSession(), 'agent', 'admin');
    const { id } = await context.params;
    const input = statusChangeSchema.parse(await readJson(request));

    return NextResponse.json({ event: await changeTicketStatus(id, user, input) });
  },
);
