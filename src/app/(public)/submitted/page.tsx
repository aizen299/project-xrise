import Link from 'next/link';
import { CheckCircle2, Search } from 'lucide-react';
import { isTicketIdShape } from '@/lib/ticket-id';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CopyButton } from './copy-button';

export const metadata = { title: 'Ticket submitted · XRise Helpdesk' };

export default async function SubmittedPage({ searchParams }: PageProps<'/submitted'>) {
  const { id } = await searchParams;
  const ticketId = typeof id === 'string' && isTicketIdShape(id) ? id.toUpperCase() : null;

  if (!ticketId) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Ticket reference missing</h1>
        <p className="text-sm text-muted-foreground">
          We could not read a ticket ID from this link.{' '}
          <Link href="/status" className="text-foreground underline underline-offset-4">
            Look up a ticket
          </Link>{' '}
          or{' '}
          <Link href="/" className="text-foreground underline underline-offset-4">
            submit a new one
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="animate-rise flex flex-col items-start gap-3">
        <span className="grid size-12 place-items-center rounded-2xl bg-status-resolved-soft text-status-resolved">
          <CheckCircle2 className="size-6" />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight">Ticket submitted</h1>
        <p className="text-muted-foreground">
          Save this ID. You will need it, with your email address, to check progress.
        </p>
      </div>

      <Card className="animate-rise surface" style={{ animationDelay: '60ms' }}>
        <CardContent className="flex flex-wrap items-center gap-6 pt-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Ticket ID
            </p>
            <p className="mt-1.5 font-mono text-2xl font-semibold tracking-[0.15em]">{ticketId}</p>
          </div>
          <div className="ml-auto">
            <CopyButton value={ticketId} />
          </div>
        </CardContent>
      </Card>

      <div
        className="animate-rise flex flex-wrap gap-3"
        style={{ animationDelay: '120ms' }}
      >
        <Button asChild>
          <Link href={`/status?ticketId=${encodeURIComponent(ticketId)}`}>
            <Search className="size-4" />
            Check its status
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Submit another ticket</Link>
        </Button>
      </div>
    </div>
  );
}
