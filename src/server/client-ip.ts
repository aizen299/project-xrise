import type { NextRequest } from 'next/server';

/**
 * Best-effort client identity for rate limiting.
 *
 * `x-forwarded-for` is client-controllable in general, but on Vercel (and any
 * sane proxy) the platform overwrites it with the real peer address, so the
 * FIRST entry is the trustworthy one. Self-hosting behind a different proxy
 * would need this adjusted — trusting the header blindly on a naked origin
 * lets a caller rotate the value and sidestep the limit entirely.
 *
 * Falls back to a fixed bucket rather than to "unlimited": in local
 * development every caller shares one window, which is the safe direction to
 * fail.
 */
export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return request.headers.get('x-real-ip')?.trim() || 'unknown-client';
}
