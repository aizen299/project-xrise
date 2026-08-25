import { StatusLookup } from './status-lookup';

export const metadata = { title: 'Check a ticket · XRise Helpdesk' };

export default async function StatusPage({ searchParams }: PageProps<'/status'>) {
  const { ticketId } = await searchParams;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Check a ticket</h1>
        <p className="mt-2 text-sm opacity-70">
          Enter your ticket ID and the email address you used. No account needed.
        </p>
      </div>
      <StatusLookup initialTicketId={typeof ticketId === 'string' ? ticketId : ''} />
    </div>
  );
}
