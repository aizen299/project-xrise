import { redirect } from 'next/navigation';
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
      <div className="flex flex-wrap items-baseline gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
        <p className="text-sm opacity-70">
          {session.role === 'admin'
            ? 'You can see every ticket.'
            : 'You can see tickets assigned to you.'}
        </p>
      </div>

      <TicketFilters agents={agents} canFilterByAssignee={session.role === 'admin'} />

      {page.rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/15 px-6 py-12 text-center dark:border-white/20">
          <p className="font-medium">
            {isFiltered ? 'No tickets match these filters' : 'No tickets yet'}
          </p>
          <p className="mt-1 text-sm opacity-70">
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
