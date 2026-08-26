import { NextResponse } from 'next/server';
import { route, readJson } from '@/server/http';
import { connectToDatabase } from '@/server/db/client';
import { createTicketSchema, parseTicketListQuery } from '@/server/validation/schemas';
import { createTicket, listTickets, type UploadedFile } from '@/server/services/ticket.service';
import { enforceRateLimit, POLICIES } from '@/server/ratelimit';
import { clientIp } from '@/server/client-ip';
import { getSession } from '@/server/auth/session';
import { requireRole } from '@/server/auth/guards';

export const runtime = 'nodejs';

async function readSubmission(request: Request) {
  const contentType = request.headers.get('content-type') ?? '';

  if (!contentType.includes('multipart/form-data')) {
    return { input: createTicketSchema.parse(await readJson(request as never)), files: [] };
  }

  const form = await request.formData();
  const text = (key: string) => {
    const value = form.get(key);
    return typeof value === 'string' ? value : undefined;
  };

  const input = createTicketSchema.parse({
    customerName: text('customerName'),
    customerEmail: text('customerEmail'),
    subject: text('subject'),
    body: text('body'),
    ...(text('priority') ? { priority: text('priority') } : {}),
  });

  const files: UploadedFile[] = [];
  for (const entry of form.getAll('attachments')) {
    if (typeof entry === 'string' || entry.size === 0) continue;
    files.push({
      name: entry.name,
      type: entry.type,
      size: entry.size,
      buffer: Buffer.from(await entry.arrayBuffer()),
    });
  }

  return { input, files };
}

export const POST = route(async (request) => {
  await connectToDatabase();
  await enforceRateLimit(`ticket-create:${clientIp(request)}`, POLICIES.ticketCreate);

  const { input, files } = await readSubmission(request);
  const { ticketId } = await createTicket(input, files);

  return NextResponse.json({ ticketId, attachments: files.length }, { status: 201 });
});

export const GET = route(async (request) => {
  await connectToDatabase();

  const user = requireRole(await getSession(), 'agent', 'admin');
  const query = parseTicketListQuery(request.nextUrl.searchParams);

  return NextResponse.json(await listTickets(user, query));
});
