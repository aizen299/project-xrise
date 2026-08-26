import { Readable } from 'node:stream';
import { route } from '@/server/http';
import { connectToDatabase } from '@/server/db/client';
import { getSession } from '@/server/auth/session';
import { getTicketForUser } from '@/server/services/ticket.service';
import { Ticket } from '@/server/db/models';
import { notFound } from '@/server/errors';
import {
  attachmentContentType,
  findAttachment,
  openAttachmentDownload,
} from '@/server/db/attachments';
import { statusLookupSchema } from '@/server/validation/schemas';
import { enforceRateLimit, POLICIES } from '@/server/ratelimit';
import { clientIp } from '@/server/client-ip';

export const runtime = 'nodejs';

export const GET = route<RouteContext<'/api/attachments/[id]'>>(async (request, context) => {
  await connectToDatabase();

  const { id } = await context.params;
  const { file, ticketId } = await findAttachment(id);

  const session = await getSession();

  if (session) {
    await getTicketForUser(ticketId.toString(), session);
  } else {
    await enforceRateLimit(`attachment:${clientIp(request)}`, POLICIES.statusCheck);

    const params = request.nextUrl.searchParams;
    const lookup = statusLookupSchema.parse({
      ticketId: params.get('ticketId') ?? '',
      email: params.get('email') ?? '',
    });

    const owner = await Ticket.findOne({
      _id: ticketId,
      ticketId: lookup.ticketId,
      customerEmail: lookup.email,
    }).lean<{ _id: unknown }>();

    if (!owner) throw notFound('Attachment not found.');
  }

  const webStream = Readable.toWeb(
    openAttachmentDownload(id) as Readable,
  ) as unknown as ReadableStream;

  return new Response(webStream, {
    headers: {
      'Content-Type': attachmentContentType(file),
      'Content-Length': String(file.length),
      'Content-Disposition': `attachment; filename="${file.filename.replace(/"/g, '')}"`,
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Cache-Control': 'private, max-age=300',
    },
  });
});
