import { redirect } from 'next/navigation';
import { getSession } from '@/server/auth/session';
import { connectToDatabase } from '@/server/db/client';
import { countTicketsForUser } from '@/server/services/ticket.service';

export const metadata = { title: 'Dashboard · XRise Helpdesk' };

/**
 * Phase 2 placeholder. It exists to prove the whole chain end to end — cookie,
 * JWT verification, session, and a database query that is scoped by role. The
 * real list, filters, search and pagination arrive in Phase 4.
 */
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  await connectToDatabase();
  const visible = await countTicketsForUser(session);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-sm opacity-70">
        Signed in as {session.email} ({session.role}).
      </p>
      <div className="rounded-lg border border-black/10 p-6 dark:border-white/15">
        <p className="text-4xl font-semibold tabular-nums">{visible}</p>
        <p className="mt-1 text-sm opacity-70">
          {session.role === 'admin'
            ? 'tickets in the system — admins see everything'
            : 'tickets assigned to you — agents see only their own'}
        </p>
      </div>
      <p className="text-sm opacity-60">
        Ticket list, filters, server-side search and pagination land in Phase 4.
      </p>
    </div>
  );
}
