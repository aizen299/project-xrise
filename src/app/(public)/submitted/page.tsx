import Link from 'next/link';
import { isTicketIdShape } from '@/lib/ticket-id';
import { CopyButton } from './copy-button';

export const metadata = { title: 'Ticket submitted · XRise Helpdesk' };

export default async function SubmittedPage({ searchParams }: PageProps<'/submitted'>) {
  const { id } = await searchParams;
  const ticketId = typeof id === 'string' && isTicketIdShape(id) ? id.toUpperCase() : null;

  if (!ticketId) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Ticket reference missing</h1>
        <p className="text-sm opacity-70">
          We could not read a ticket ID from this link.{' '}
          <Link href="/status" className="underline underline-offset-4">
            Look up a ticket
          </Link>{' '}
          or{' '}
          <Link href="/" className="underline underline-offset-4">
            submit a new one
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ticket submitted</h1>
        <p className="mt-2 text-sm opacity-70">
          Save this ID. You will need it, along with your email address, to check progress.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-black/10 p-6 dark:border-white/15">
        <div>
          <p className="text-xs uppercase tracking-wide opacity-60">Ticket ID</p>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-wider">{ticketId}</p>
        </div>
        <div className="ml-auto">
          <CopyButton value={ticketId} />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <Link
          href={`/status?ticketId=${encodeURIComponent(ticketId)}`}
          className="rounded-md bg-foreground px-4 py-2 font-medium text-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          Check its status
        </Link>
        <Link
          href="/"
          className="rounded-md border border-black/15 px-4 py-2 transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-white/20 dark:hover:bg-white/10"
        >
          Submit another ticket
        </Link>
      </div>
    </div>
  );
}
