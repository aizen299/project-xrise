import Link from 'next/link';

export default function TicketNotFound() {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-dashed border-black/15 px-6 py-12 text-center dark:border-white/20">
      <p className="font-medium">Ticket not found</p>
      <p className="text-sm opacity-70">
        It may not exist, or it may not be assigned to you.
      </p>
      <Link href="/dashboard" className="text-sm underline underline-offset-4">
        Back to tickets
      </Link>
    </div>
  );
}
