'use client';

import { useRouter } from 'next/navigation';
import { useOptimistic, useState, useSyncExternalStore, useTransition } from 'react';
import { PriorityBadge, StatusBadge } from '@/components/tickets/badges';
import { TICKET_STATUSES, type TicketEventType, type TicketStatus } from '@/types';
import type { AssignableAgent } from '@/server/services/agent.service';

export interface ClientEvent {
  id: string;
  type: TicketEventType;
  actorName: string;
  actorKind: string;
  payload: Record<string, unknown>;
  createdAt: string;
  pending?: boolean;
}

export interface ClientTicket {
  id: string;
  ticketId: string;
  subject: string;
  body: string;
  customerName: string;
  customerEmail: string;
  status: TicketStatus;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee: { id: string; name: string } | null;
  createdAt: string;
  events: ClientEvent[];
}

const control =
  'rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-white/20';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatUtc(iso: string) {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}, ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

const subscribeToNothing = () => () => {};

function TimeStamp({ iso }: { iso: string }) {
  const label = useSyncExternalStore(
    subscribeToNothing,
    () => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
    () => formatUtc(iso),
  );

  return <time dateTime={iso}>{label}</time>;
}

function describe(event: ClientEvent) {
  const from = String(event.payload.from ?? '');
  const to = String(event.payload.to ?? '');

  switch (event.type) {
    case 'created':
      return `${event.actorName} submitted this ticket`;
    case 'replied':
      return `${event.actorName} replied`;
    case 'status_changed':
      return `${event.actorName} changed status from ${from} to ${to}`;
    case 'reassigned':
      return `${event.actorName} reassigned this from ${from} to ${to}`;
    default:
      return event.actorName;
  }
}

export function TicketWorkspace({
  ticket,
  agents,
  canReassign,
  currentUserName,
}: {
  ticket: ClientTicket;
  agents: AssignableAgent[];
  canReassign: boolean;
  currentUserName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [events, addOptimisticEvent] = useOptimistic<ClientEvent[], ClientEvent>(
    ticket.events,
    (current, next) => [...current, next],
  );
  const [status, applyOptimisticStatus] = useOptimistic<TicketStatus, TicketStatus>(
    ticket.status,
    (_, next) => next,
  );

  function run(optimistic: () => void, request: () => Promise<Response>, fallbackMessage: string) {
    setError(null);
    startTransition(async () => {
      optimistic();
      try {
        const response = await request();
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: { message?: string } }
            | null;
          setError(payload?.error?.message ?? fallbackMessage);
          return;
        }
        router.refresh();
      } catch {
        setError(fallbackMessage);
      }
    });
  }

  function submitReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const value = new FormData(form).get('body');
    const body = typeof value === 'string' ? value.trim() : '';
    if (!body) return;

    form.reset();
    run(
      () =>
        addOptimisticEvent({
          id: `pending-${Date.now()}`,
          type: 'replied',
          actorName: currentUserName,
          actorKind: 'agent',
          payload: { body },
          createdAt: new Date().toISOString(),
          pending: true,
        }),
      () =>
        fetch(`/api/tickets/${ticket.id}/replies`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body }),
        }),
      'Could not send the reply.',
    );
  }

  function changeStatus(next: TicketStatus) {
    if (next === status) return;
    run(
      () => applyOptimisticStatus(next),
      () =>
        fetch(`/api/tickets/${ticket.id}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: next }),
        }),
      'Could not change the status.',
    );
  }

  function reassign(assigneeId: string) {
    run(
      () => undefined,
      () =>
        fetch(`/api/tickets/${ticket.id}/assignee`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assigneeId }),
        }),
      'Could not reassign the ticket.',
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div aria-live="assertive">
        {error ? (
          <p
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
          >
            {error}
          </p>
        ) : null}
      </div>

      <header className="flex flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-wide opacity-60">{ticket.ticketId}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{ticket.subject}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          <PriorityBadge priority={ticket.priority} />
          <span className="text-sm opacity-70">
            {ticket.customerName} · {ticket.customerEmail}
          </span>
        </div>
      </header>

      <section aria-label="Actions" className="flex flex-wrap items-end gap-4 rounded-lg border border-black/10 p-4 dark:border-white/15">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium">Status</label>
          <select
            id="status"
            className={control}
            value={status}
            disabled={pending}
            onChange={(event) => changeStatus(event.target.value as TicketStatus)}
          >
            {TICKET_STATUSES.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        {canReassign ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="assignee" className="text-sm font-medium">Assignee</label>
            <select
              id="assignee"
              className={control}
              value={ticket.assignee?.id ?? 'unassigned'}
              disabled={pending}
              onChange={(event) => reassign(event.target.value)}
            >
              <option value="unassigned">Unassigned</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Assignee</span>
            <p className="px-1 py-2 text-sm opacity-70">{ticket.assignee?.name ?? 'Unassigned'}</p>
          </div>
        )}

        <span aria-live="polite" className="ml-auto text-sm opacity-70">
          {pending ? 'Saving…' : ''}
        </span>
      </section>

      <section aria-label="Timeline" className="flex flex-col gap-4">
        <h2 className="text-sm font-medium uppercase tracking-wide opacity-70">Timeline</h2>
        <ol className="flex flex-col gap-4">
          {events.map((event) => (
            <li
              key={event.id}
              className={`rounded-lg border p-4 ${
                event.pending
                  ? 'border-dashed border-black/20 opacity-60 dark:border-white/25'
                  : 'border-black/10 dark:border-white/15'
              }`}
            >
              <p className="text-sm font-medium">{describe(event)}</p>
              {event.type === 'created' ? (
                <p className="mt-2 text-sm whitespace-pre-wrap">{ticket.body}</p>
              ) : null}
              {event.type === 'replied' ? (
                <p className="mt-2 text-sm whitespace-pre-wrap">{String(event.payload.body ?? '')}</p>
              ) : null}
              <p className="mt-2 text-xs opacity-60">
                {event.pending ? 'Sending…' : <TimeStamp iso={event.createdAt} />}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <form onSubmit={submitReply} className="flex flex-col gap-3">
        <label htmlFor="body" className="text-sm font-medium">Reply to the customer</label>
        <textarea
          id="body"
          name="body"
          rows={4}
          required
          className={`${control} resize-y`}
        />
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {pending ? 'Sending…' : 'Send reply'}
        </button>
      </form>
    </div>
  );
}
