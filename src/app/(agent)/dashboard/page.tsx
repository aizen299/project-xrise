import { redirect } from 'next/navigation';
import { Inbox, SearchX } from 'lucide-react';
import { getSession } from '@/server/auth/session';
import { connectToDatabase } from '@/server/db/client';
import { listTickets } from '@/server/services/ticket.service';
import { listAssignableAgents } from '@/server/services/agent.service';
import { ticketListQuerySchema } from '@/server/validation/schemas';
import { TicketFilters } from './ticket-filters';
import { TicketTable } from './ticket-table';
import { Pagination } from './pagination';

export const metadata = { title: 'Dashboard · XRise Helpdesk' };

function toRawQuery(searchParams: Record<string, string | string[] | undefined>) {
  const raw: Record<string, string> = {};
  for (const key of ['page', 'limit', 'status', 'priority', 'assigneeId', 'q']) {
    const value = searchParams[key];
    if (typeof value === 'string' && value !== '') raw[key] = value;
  }
  return raw;
}

export default async function DashboardPage({ searchParams }: PageProps<'/dashboard'>) {
  const session = await getSession();
  if (!session) redirect('/login');

  const params = await searchParams;
  const parsed = ticketListQuerySchema.safeParse(toRawQuery(params));
  if (!parsed.success) redirect('/dashboard');

  await connectToDatabase();
  const [page, agents] = await Promise.all([
    listTickets(session, parsed.data),
    listAssignableAgents(),
  ]);

  const isFiltered = Boolean(
    parsed.data.status || parsed.data.priority || parsed.data.assigneeId || parsed.data.q,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="animate-rise flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
        <p className="text-sm text-muted-foreground">
          {session.role === 'admin'
            ? 'You can see every ticket.'
            : 'You can see tickets assigned to you.'}
        </p>
      </div>

      <div className="animate-rise" style={{ animationDelay: '50ms' }}>
        <TicketFilters agents={agents} canFilterByAssignee={session.role === 'admin'} />
      </div>

      {page.rows.length === 0 ? (
        <div className="animate-rise surface flex flex-col items-center gap-3 rounded-xl px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-muted-foreground">
            {isFiltered ? <SearchX className="size-6" /> : <Inbox className="size-6" />}
          </span>
          <p className="font-medium">
            {isFiltered ? 'No tickets match these filters' : 'No tickets yet'}
          </p>
          <p className="max-w-sm text-sm text-muted-foreground">
            {isFiltered
              ? 'Try widening the search, or clear the filters to see everything you have access to.'
              : session.role === 'admin'
                ? 'Tickets submitted from the public form will appear here.'
                : 'Tickets assigned to you will appear here.'}
          </p>
        </div>
      ) : (
        <>
          <TicketTable rows={page.rows} />
          <Pagination
            page={page.page}
            totalPages={page.totalPages}
            total={page.total}
            searchParams={params}
          />
        </>
      )}
    </div>
  );
}
