import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearTestDb, startTestDb, stopTestDb } from '../helpers/db';
import { RateLimit } from '../../src/server/db/models';
import { consumeRateLimit, enforceRateLimit, POLICIES } from '../../src/server/ratelimit';
import { rejection } from '../helpers/rejection';

const POLICY = { limit: 3, windowSeconds: 60 };

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

describe('fixed-window rate limiting (REQ-032)', () => {
  it('admits exactly the configured number of requests', async () => {
    for (let i = 1; i <= POLICY.limit; i += 1) {
      const result = await consumeRateLimit('ip:1.2.3.4', POLICY);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(POLICY.limit - i);
    }

    const overflow = await consumeRateLimit('ip:1.2.3.4', POLICY);
    expect(overflow.allowed).toBe(false);
    expect(overflow.remaining).toBe(0);
  });

  it('keeps counting past the limit so a flood stays blocked', async () => {
    for (let i = 0; i < POLICY.limit + 5; i += 1) await consumeRateLimit('ip:flood', POLICY);
    expect((await consumeRateLimit('ip:flood', POLICY)).allowed).toBe(false);
  });

  it('gives each identifier its own budget', async () => {
    for (let i = 0; i < POLICY.limit; i += 1) await consumeRateLimit('ip:noisy', POLICY);

    expect((await consumeRateLimit('ip:noisy', POLICY)).allowed).toBe(false);

    expect((await consumeRateLimit('ip:quiet', POLICY)).allowed).toBe(true);
  });

  it('reports a positive retry hint that never exceeds the window', async () => {
    const result = await consumeRateLimit('ip:retry', POLICY);
    expect(result.retryAfterSeconds).toBeGreaterThan(0);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(POLICY.windowSeconds);
    expect(result.resetAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('starts a fresh budget once the window rolls over', async () => {
    const shortPolicy = { limit: 1, windowSeconds: 1 };
    const windowMs = shortPolicy.windowSeconds * 1000;

    const remaining = windowMs - (Date.now() % windowMs);
    if (remaining < windowMs * 0.6) {
      await new Promise((resolve) => setTimeout(resolve, remaining + 25));
    }

    expect((await consumeRateLimit('ip:rollover', shortPolicy)).allowed).toBe(true);
    expect((await consumeRateLimit('ip:rollover', shortPolicy)).allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect((await consumeRateLimit('ip:rollover', shortPolicy)).allowed).toBe(true);
  });

  it('stores an expiry so MongoDB reaps the window without a cleanup job', async () => {
    await consumeRateLimit('ip:ttl', POLICY);
    const doc = await RateLimit.findOne({ key: /^ip:ttl:/ });

    expect(doc).not.toBeNull();
    expect(doc!.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(doc!.count).toBe(1);
  });

  it('survives concurrent first-requests racing on the same key', async () => {
    
    const results = await Promise.all(
      Array.from({ length: 8 }, () => consumeRateLimit('ip:race', { limit: 100, windowSeconds: 60 })),
    );

    expect(results.every((r) => r.allowed)).toBe(true);
    const doc = await RateLimit.findOne({ key: /^ip:race:/ });
    expect(doc!.count).toBe(8);
  });
});

describe('enforceRateLimit', () => {
  it('passes through while budget remains', async () => {
    await expect(enforceRateLimit('ip:ok', POLICY)).resolves.toMatchObject({ allowed: true });
  });

  it('throws RATE_LIMITED carrying a Retry-After hint', async () => {
    for (let i = 0; i < POLICY.limit; i += 1) await enforceRateLimit('ip:over', POLICY);

    const error = await rejection(enforceRateLimit('ip:over', POLICY));
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.status).toBe(429);
    expect(error.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe('configured policies', () => {
  it('limits login tightly enough to make online guessing impractical', () => {
    expect(POLICIES.login.limit).toBeLessThanOrEqual(10);
    expect(POLICIES.login.windowSeconds).toBeGreaterThanOrEqual(600);
  });

  it('covers all three unauthenticated entry points', () => {
    expect(Object.keys(POLICIES).sort()).toEqual(['login', 'statusCheck', 'ticketCreate']);
  });
});
