import { ZodError } from 'zod';

/**
 * Every error the API returns uses one of these codes, and every code maps to
 * exactly one HTTP status. This is what makes the error shape consistent
 * (REQ-029) without each route handler inventing its own.
 */
export const ERROR_STATUS = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_STATUS;

export interface FieldIssue {
  path: string;
  message: string;
}

export interface ErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: FieldIssue[];
    requestId: string;
  };
}

/**
 * An error that is safe to show a client. Anything that is NOT an AppError is
 * treated as an internal fault and its message is replaced before serialising,
 * so stack traces and driver internals can never reach the response body.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: FieldIssue[];
  /** Populated for RATE_LIMITED so the transport can send `Retry-After`. */
  readonly retryAfterSeconds?: number;

  constructor(
    code: ErrorCode,
    message: string,
    details?: FieldIssue[],
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = ERROR_STATUS[code];
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export const badRequest = (message: string, details?: FieldIssue[]) =>
  new AppError('VALIDATION_ERROR', message, details);
export const unauthorized = (message = 'Authentication required.') =>
  new AppError('UNAUTHORIZED', message);
export const forbidden = (message = 'You do not have access to this resource.') =>
  new AppError('FORBIDDEN', message);
/**
 * Used for both "does not exist" and "exists but is out of your scope".
 * Deliberately identical so ticket IDs cannot be probed for existence by an
 * agent who is not assigned to them.
 */
export const notFound = (message = 'Not found.') => new AppError('NOT_FOUND', message);
export const conflict = (message: string) => new AppError('CONFLICT', message);
export const rateLimited = (
  message = 'Too many requests. Please try again shortly.',
  retryAfterSeconds?: number,
) => new AppError('RATE_LIMITED', message, undefined, retryAfterSeconds);

/** Flattens a ZodError into the transport-level field issue list. */
export function zodToIssues(error: ZodError): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

const GENERIC_INTERNAL_MESSAGE = 'An unexpected error occurred.';

/**
 * Converts any thrown value into the wire format. The returned `logLevel` and
 * `cause` tell the caller what to log; `body` is all the client ever sees.
 */
export function toErrorResponse(
  error: unknown,
  requestId: string,
): { status: number; body: ErrorBody; logLevel: 'warn' | 'error'; cause: unknown } {
  if (error instanceof ZodError) {
    const appError = badRequest('The submitted data is invalid.', zodToIssues(error));
    return {
      status: appError.status,
      body: { error: { code: appError.code, message: appError.message, details: appError.details, requestId } },
      logLevel: 'warn',
      cause: error,
    };
  }

  if (error instanceof AppError) {
    return {
      status: error.status,
      body: {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
          requestId,
        },
      },
      // 5xx AppErrors are still our fault; 4xx are the caller's.
      logLevel: error.status >= 500 ? 'error' : 'warn',
      cause: error,
    };
  }

  // Unknown failure: never surface the message, it may contain query
  // fragments, file paths or connection strings.
  return {
    status: ERROR_STATUS.INTERNAL,
    body: { error: { code: 'INTERNAL', message: GENERIC_INTERNAL_MESSAGE, requestId } },
    logLevel: 'error',
    cause: error,
  };
}
