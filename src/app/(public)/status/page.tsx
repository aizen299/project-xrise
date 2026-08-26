import { StatusLookup } from './status-lookup';

export const metadata = { title: 'Check a ticket · XRise Helpdesk' };

export default async function StatusPage({ searchParams }: PageProps<'/status'>) {
  const { ticketId } = await searchParams;

  return (
    <div className="flex flex-col gap-8">
      <div className="animate-rise flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Check a ticket</h1>
        <p className="text-muted-foreground">
          Enter your ticket ID and the email address you used. No account needed.
        </p>
      </div>
      <StatusLookup initialTicketId={typeof ticketId === 'string' ? ticketId : ''} />
    </div>
  );
}
