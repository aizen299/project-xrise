import { NextResponse } from 'next/server';
import { readJson, route } from '@/server/http';
import { connectToDatabase } from '@/server/db/client';
import { getSession } from '@/server/auth/session';
import { requireRole } from '@/server/auth/guards';
import { reassignSchema } from '@/server/validation/schemas';
import { reassignTicket } from '@/server/services/ticket.service';

export const runtime = 'nodejs';

export const PATCH = route<RouteContext<'/api/tickets/[id]/assignee'>>(
  async (request, context) => {
    await connectToDatabase();

    const user = requireRole(await getSession(), 'admin');
    const { id } = await context.params;
    const input = reassignSchema.parse(await readJson(request));

    return NextResponse.json({ event: await reassignTicket(id, user, input) });
  },
);
