import type { TicketPriority, TicketStatus } from '@/types';

const STATUS_STYLE: Record<TicketStatus, string> = {
  open: 'border-blue-400/70 text-blue-700 dark:text-blue-300',
  pending: 'border-amber-400/70 text-amber-700 dark:text-amber-300',
  resolved: 'border-green-400/70 text-green-700 dark:text-green-300',
  closed: 'border-neutral-400/70 text-neutral-600 dark:text-neutral-400',
};

const PRIORITY_STYLE: Record<TicketPriority, string> = {
  low: 'border-neutral-400/70 text-neutral-600 dark:text-neutral-400',
  medium: 'border-sky-400/70 text-sky-700 dark:text-sky-300',
  high: 'border-orange-400/70 text-orange-700 dark:text-orange-300',
  urgent: 'border-red-400/70 text-red-700 dark:text-red-300',
};

const BASE =
  'inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium uppercase tracking-wide';

export function StatusBadge({ status }: { status: TicketStatus }) {
  return <span className={`${BASE} ${STATUS_STYLE[status]}`}>{status}</span>;
}

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  return (
    <span className={`${BASE} ${PRIORITY_STYLE[priority]}`}>
      <span className="sr-only">Priority: </span>
      {priority}
    </span>
  );
}
