import pino from 'pino';

/**
 * Structured JSON logs (REQ-030). No pino transport is configured on purpose:
 * transports run in worker threads, which the Next.js bundler cannot trace.
 * Pipe through `pino-pretty` locally instead — see the dev:pretty script.
 */
const REDACT_PATHS = [
  'password',
  '*.password',
  'passwordHash',
  '*.passwordHash',
  'token',
  '*.token',
  'jwt',
  '*.jwt',
  'headers.authorization',
  'headers.cookie',
  'req.headers.authorization',
  'req.headers.cookie',
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  base: { service: 'xrise-helpdesk' },
  redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  formatters: { level: (label) => ({ level: label }) },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Correlates a client-visible error with its server-side stack trace. The id
 * goes in the response body; the stack only ever goes to the log.
 */
export function newRequestId(): string {
  return `req_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
}
