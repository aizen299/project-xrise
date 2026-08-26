import { connectToDatabase } from '@/server/db/client';
import { getSession } from '@/server/auth/session';
import { requireRole } from '@/server/auth/guards';
import { countTicketEventsSince, getTicketForUser } from '@/server/services/ticket.service';
import { logger, newRequestId } from '@/server/logger';
import { toErrorResponse } from '@/server/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const POLL_INTERVAL_MS = 3_000;
const STREAM_LIFETIME_MS = 50_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(
  request: Request,
  context: RouteContext<'/api/tickets/[id]/stream'>,
) {
  const requestId = newRequestId();
  const { id } = await context.params;

  let user;
  try {
    await connectToDatabase();
    user = requireRole(await getSession(), 'agent', 'admin');
    await getTicketForUser(id, user);
  } catch (error) {
    const { status, body, logLevel, cause } = toErrorResponse(error, requestId);
    logger[logLevel]({ requestId, path: `/api/tickets/${id}/stream`, status, err: cause }, 'stream rejected');
    return Response.json(body, { status });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const push = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const abort = () => {
        closed = true;
      };
      request.signal.addEventListener('abort', abort);

      push('connected', { ticketId: id, pollMs: POLL_INTERVAL_MS });

      let since = new Date();
      const deadline = Date.now() + STREAM_LIFETIME_MS;

      try {
        while (!closed && Date.now() < deadline) {
          await sleep(POLL_INTERVAL_MS);
          if (closed) break;

          const fresh = await countTicketEventsSince(id, user, since);
          if (fresh > 0) {
            since = new Date();
            push('timeline', { changed: fresh });
          } else {
            controller.enqueue(encoder.encode(': keep-alive\n\n'));
          }
        }
      } catch (error) {
        logger.warn({ event: 'stream.failed', ticket: id, err: error }, 'ticket stream ended early');
      } finally {
        request.signal.removeEventListener('abort', abort);
        if (!closed) {
          push('bye', { reason: 'lifetime' });
          controller.close();
        }
      }
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
