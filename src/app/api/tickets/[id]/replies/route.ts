import { NextResponse } from 'next/server';
import { readJson, route } from '@/server/http';
import { connectToDatabase } from '@/server/db/client';
import { getSession } from '@/server/auth/session';
import { requireRole } from '@/server/auth/guards';
import { replySchema } from '@/server/validation/schemas';
import { addReply } from '@/server/services/ticket.service';

export const runtime = 'nodejs';

export const POST = route<RouteContext<'/api/tickets/[id]/replies'>>(
  async (request, context) => {
    await connectToDatabase();

    const user = requireRole(await getSession(), 'agent', 'admin');
    const { id } = await context.params;
    const input = replySchema.parse(await readJson(request));

    return NextResponse.json({ event: await addReply(id, user, input) }, { status: 201 });
  },
);
