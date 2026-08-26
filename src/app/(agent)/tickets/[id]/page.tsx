import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSession } from '@/server/auth/session';
import { connectToDatabase } from '@/server/db/client';
import { getTicketDetail } from '@/server/services/ticket.service';
import { listAssignableAgents } from '@/server/services/agent.service';
import { AppError } from '@/server/errors';
import { isAiEnabled } from '@/server/ai/provider';
import { TicketWorkspace, type ClientTicket } from './ticket-workspace';

export const metadata = { title: 'Ticket · XRise Helpdesk' };

export default async function TicketDetailPage({ params }: PageProps<'/tickets/[id]'>) {
  const session = await getSession();
  if (!session) redirect('/login');

  const { id } = await params;
  await connectToDatabase();

  let detail;
  try {
    detail = await getTicketDetail(id, session);
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }

  const agents = session.role === 'admin' ? await listAssignableAgents() : [];

  const ticket: ClientTicket = {
    ...detail,
    createdAt: detail.createdAt.toISOString(),
    events: detail.events.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    })),
  };

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 self-start">
        <Link href="/dashboard">
          <ArrowLeft className="size-4" />
          Back to tickets
        </Link>
      </Button>
      <TicketWorkspace
        ticket={ticket}
        agents={agents}
        canReassign={session.role === 'admin'}
        currentUserName={session.name}
        aiEnabled={isAiEnabled()}
      />
    </div>
  );
}
