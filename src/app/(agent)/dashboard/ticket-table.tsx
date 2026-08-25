import Link from 'next/link';
import { PriorityBadge, StatusBadge } from '@/components/tickets/badges';
import type { TicketListRow } from '@/server/services/ticket.service';

function formatDate(value: Date) {
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function TicketTable({ rows }: { rows: TicketListRow[] }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Tickets matching the current filters</caption>
          <thead>
            <tr className="border-b border-black/10 text-left dark:border-white/15">
              <th scope="col" className="py-2 pr-4 font-medium">Ticket</th>
              <th scope="col" className="py-2 pr-4 font-medium">Status</th>
              <th scope="col" className="py-2 pr-4 font-medium">Priority</th>
              <th scope="col" className="py-2 pr-4 font-medium">Assignee</th>
              <th scope="col" className="py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-black/5 dark:border-white/10">
                <td className="py-3 pr-4">
                  <Link
                    href={`/tickets/${row.id}`}
                    className="font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-blue-600"
                  >
                    {row.subject}
                  </Link>
                  <p className="mt-0.5 font-mono text-xs opacity-60">
                    {row.ticketId} · {row.customerName}
                  </p>
                </td>
                <td className="py-3 pr-4"><StatusBadge status={row.status} /></td>
                <td className="py-3 pr-4"><PriorityBadge priority={row.priority} /></td>
                <td className="py-3 pr-4">
                  {row.assignee ? row.assignee.name : <span className="opacity-60">Unassigned</span>}
                </td>
                <td className="py-3 whitespace-nowrap opacity-70">{formatDate(row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg border border-black/10 p-4 dark:border-white/15">
            <Link
              href={`/tickets/${row.id}`}
              className="font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {row.subject}
            </Link>
            <p className="mt-1 font-mono text-xs opacity-60">
              {row.ticketId} · {row.customerName}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={row.status} />
              <PriorityBadge priority={row.priority} />
            </div>
            <p className="mt-3 text-xs opacity-70">
              {row.assignee ? row.assignee.name : 'Unassigned'} · {formatDate(row.createdAt)}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
