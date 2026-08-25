import { NextResponse } from 'next/server';
import { route } from '@/server/http';
import { connectToDatabase } from '@/server/db/client';
import { getSession } from '@/server/auth/session';
import { requireRole } from '@/server/auth/guards';
import { listAssignableAgents } from '@/server/services/agent.service';

export const runtime = 'nodejs';

export const GET = route(async () => {
  await connectToDatabase();
  requireRole(await getSession(), 'agent', 'admin');

  return NextResponse.json({ agents: await listAssignableAgents() });
});
