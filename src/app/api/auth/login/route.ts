import { NextResponse } from 'next/server';
import { route, readJson } from '@/server/http';
import { connectToDatabase } from '@/server/db/client';
import { loginSchema } from '@/server/validation/schemas';
import { authenticateAgent } from '@/server/services/auth.service';
import { signSessionToken } from '@/server/auth/jwt';
import { sessionCookie } from '@/server/auth/session';
import { enforceRateLimit, POLICIES } from '@/server/ratelimit';
import { clientIp } from '@/server/client-ip';

export const runtime = 'nodejs';

export const POST = route(async (request) => {
  await connectToDatabase();


  await enforceRateLimit(`login:${clientIp(request)}`, POLICIES.login);

  const input = loginSchema.parse(await readJson(request));
  const claims = await authenticateAgent(input);
  const token = await signSessionToken(claims);

  const response = NextResponse.json({ user: claims });
  response.cookies.set(sessionCookie(token));
  return response;
});
