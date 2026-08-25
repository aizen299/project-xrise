import { NextResponse, type NextRequest } from 'next/server';
import { logger, newRequestId } from './logger';
import { badRequest, toErrorResponse } from './errors';

type Handler<C> = (request: NextRequest, context: C) => Promise<Response>;

/**
 * Wraps a Route Handler so that every response — success or failure — is
 * logged as one structured record, and every thrown error is serialised
 * through the single error formatter. Handlers therefore never build an error
 * response themselves, which is what keeps the shape consistent (REQ-029) and
 * stack traces server-side (REQ-030).
 */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (request, context) => {
    const requestId = newRequestId();
    const startedAt = Date.now();
    const path = new URL(request.url).pathname;

    try {
      const response = await handler(request, context);
      logger.info(
        { requestId, method: request.method, path, status: response.status, durationMs: Date.now() - startedAt },
        'request completed',
      );
      return response;
    } catch (error) {
      const { status, body, logLevel, cause } = toErrorResponse(error, requestId);
      logger[logLevel](
        { requestId, method: request.method, path, status, durationMs: Date.now() - startedAt, err: cause },
        'request failed',
      );
      return NextResponse.json(body, { status });
    }
  };
}

/** Parses a JSON body, turning malformed input into a 400 rather than a 500. */
export async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw badRequest('Expected a JSON request body.');
  }
}
