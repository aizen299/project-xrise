import { cn } from '@/lib/utils';
import type { TicketPriority, TicketStatus } from '@/types';

const BASE =
  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider';

const STATUS: Record<TicketStatus, string> = {
  open: 'border-status-open/25 bg-status-open-soft text-status-open',
  pending: 'border-status-pending/25 bg-status-pending-soft text-status-pending',
  resolved: 'border-status-resolved/25 bg-status-resolved-soft text-status-resolved',
  closed: 'border-status-closed/25 bg-status-closed-soft text-status-closed',
};

const PRIORITY: Record<TicketPriority, string> = {
  low: 'border-priority-low/25 bg-priority-low-soft text-priority-low',
  medium: 'border-priority-medium/25 bg-priority-medium-soft text-priority-medium',
  high: 'border-priority-high/25 bg-priority-high-soft text-priority-high',
  urgent: 'border-priority-urgent/25 bg-priority-urgent-soft text-priority-urgent',
};

export function StatusBadge({ status, className }: { status: TicketStatus; className?: string }) {
  return (
    <span className={cn(BASE, STATUS[status], className)}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {status}
    </span>
  );
}

export function PriorityBadge({
  priority,
  className,
}: {
  priority: TicketPriority;
  className?: string;
}) {
  return (
    <span className={cn(BASE, PRIORITY[priority], className)}>
      <span className="sr-only">Priority: </span>
      {priority}
    </span>
  );
}
