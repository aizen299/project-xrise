import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { PriorityBadge, StatusBadge } from '@/components/tickets/badges';
import type { TicketListRow } from '@/server/services/ticket.service';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

function formatDate(value: Date) {
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function Assignee({ name }: { name: string | null }) {
  if (!name) return <span className="text-muted-foreground">Unassigned</span>;
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('');

  return (
    <span className="flex items-center gap-2">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-medium text-secondary-foreground">
        {initials}
      </span>
      {name}
    </span>
  );
}

export function TicketTable({ rows }: { rows: TicketListRow[] }) {
  return (
    <>
      <div className="surface hidden overflow-hidden rounded-xl md:block">
        <Table>
          <TableCaption className="sr-only">Tickets matching the current filters</TableCaption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Ticket</TableHead>
              <TableHead className="w-32">Status</TableHead>
              <TableHead className="w-32">Priority</TableHead>
              <TableHead className="w-44">Assignee</TableHead>
              <TableHead className="w-32">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow
                key={row.id}
                className="animate-rise"
                style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
              >
                <TableCell>
                  <Link
                    href={`/tickets/${row.id}`}
                    className="font-medium underline-offset-4 hover:underline focus-visible:ring-ring/60 focus-visible:ring-[3px] focus-visible:outline-none"
                  >
                    {row.subject}
                  </Link>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {row.ticketId} · {row.customerName}
                  </p>
                </TableCell>
                <TableCell>
                  <StatusBadge status={row.status} />
                </TableCell>
                <TableCell>
                  <PriorityBadge priority={row.priority} />
                </TableCell>
                <TableCell className="text-sm">
                  <Assignee name={row.assignee?.name ?? null} />
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {formatDate(row.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((row, index) => (
          <li
            key={row.id}
            className="animate-rise"
            style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
          >
            <Link
              href={`/tickets/${row.id}`}
              className="surface surface-interactive flex flex-col gap-3 rounded-xl p-4 focus-visible:ring-ring/60 focus-visible:ring-[3px] focus-visible:outline-none"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{row.subject}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                    {row.ticketId} · {row.customerName}
                  </p>
                </div>
                <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={row.status} />
                <PriorityBadge priority={row.priority} />
              </div>
              <p className="text-xs text-muted-foreground">
                {row.assignee?.name ?? 'Unassigned'} · {formatDate(row.createdAt)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
