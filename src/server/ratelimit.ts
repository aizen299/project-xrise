import { RateLimit } from './db/models';
import { rateLimited } from './errors';

/**
 * Fixed-window rate limiting backed by MongoDB (REQ-032).
 *
 * An in-process counter cannot work here: serverless instances do not share
 * memory, so a caller only has to land on a cold container to reset their
 * budget. The window counter therefore lives in the database, where a TTL
 * index reaps expired windows without a cleanup job.
 *
 * Fixed windows can admit up to 2x the limit across a window boundary. That is
 * an accepted trade for this scale — a sliding-window or token-bucket counter
 * in Redis is the documented upgrade path.
 */

export interface RateLimitPolicy {
  /** Maximum requests permitted per window. */
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
}

export const POLICIES = {
  /** Submitting a support ticket is a rare human action. */
  ticketCreate: { limit: 10, windowSeconds: 600 },
  /** Checking status is cheap and repeated, but must not be enumerable. */
  statusCheck: { limit: 30, windowSeconds: 600 },
  /** Tight enough to make online password guessing impractical. */
  login: { limit: 10, windowSeconds: 900 },
} as const satisfies Record<string, RateLimitPolicy>;

export async function consumeRateLimit(
  identifier: string,
  policy: RateLimitPolicy,
): Promise<RateLimitResult> {
  const windowMs = policy.windowSeconds * 1000;
  const now = Date.now();
  // Bucket the timestamp so every caller in the same window shares one counter
  // and the key itself encodes expiry.
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = new Date(windowStart + windowMs);
  const key = `${identifier}:${windowStart}`;

  let count: number;
  try {
    const doc = await RateLimit.findOneAndUpdate(
      { key },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: resetAt } },
      { upsert: true, returnDocument: 'after' },
    ).lean<{ count: number }>();
    count = doc?.count ?? 1;
  } catch (error) {
    // Two concurrent first-requests can both attempt the insert; the unique
    // index rejects the loser. Its increment is safe to retry.
    if (isDuplicateKeyError(error)) {
      const doc = await RateLimit.findOneAndUpdate(
        { key },
        { $inc: { count: 1 } },
        { returnDocument: 'after' },
      ).lean<{ count: number }>();
      count = doc?.count ?? 1;
    } else {
      throw error;
    }
  }

  const remaining = Math.max(0, policy.limit - count);
  return {
    allowed: count <= policy.limit,
    limit: policy.limit,
    remaining,
    resetAt,
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt.getTime() - now) / 1000)),
  };
}

/** Consumes a slot and throws RATE_LIMITED if the window is exhausted. */
export async function enforceRateLimit(
  identifier: string,
  policy: RateLimitPolicy,
): Promise<RateLimitResult> {
  const result = await consumeRateLimit(identifier, policy);
  if (!result.allowed) {
    throw rateLimited(
      `Too many requests. Try again in ${result.retryAfterSeconds} seconds.`,
      result.retryAfterSeconds,
    );
  }
  return result;
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: number }).code === 11000;
}
