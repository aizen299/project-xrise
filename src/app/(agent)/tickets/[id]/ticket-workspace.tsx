'use client';

import { useRouter } from 'next/navigation';
import { useOptimistic, useState, useSyncExternalStore, useTransition } from 'react';
import { Loader2, MessageSquare, Send, Sparkles, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { PriorityBadge, StatusBadge } from '@/components/tickets/badges';
import { TICKET_STATUSES, type TicketEventType, type TicketStatus } from '@/types';
import type { AssignableAgent } from '@/server/services/agent.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

const EVENT_ICON: Record<TicketEventType, typeof Sparkles> = {
  created: Sparkles,
  replied: MessageSquare,
  status_changed: Loader2,
  reassigned: UserCog,
};

const EVENT_TONE: Record<TicketEventType, string> = {
  created: 'bg-primary/12 text-primary ring-primary/20',
  replied: 'bg-status-open-soft text-status-open ring-status-open/20',
  status_changed: 'bg-status-pending-soft text-status-pending ring-status-pending/20',
  reassigned: 'bg-accent text-accent-foreground ring-border',
};

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
          const message = payload?.error?.message ?? fallbackMessage;
          setError(message);
          toast.error(message);
          return;
        }
        router.refresh();
      } catch {
        setError(fallbackMessage);
        toast.error(fallbackMessage);
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
      <div aria-live="assertive" className="sr-only">
        {error}
      </div>

      <header className="animate-rise flex flex-col gap-3">
        <p className="font-mono text-xs tracking-wider text-muted-foreground">{ticket.ticketId}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{ticket.subject}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status} />
          <PriorityBadge priority={ticket.priority} />
          <span className="text-sm text-muted-foreground">
            {ticket.customerName} · {ticket.customerEmail}
          </span>
        </div>
      </header>

      <section
        aria-label="Actions"
        className="animate-rise glass flex flex-wrap items-end gap-5 rounded-xl p-4"
        style={{ animationDelay: '50ms' }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="status">Status</Label>
          <Select value={status} onValueChange={(v) => changeStatus(v as TicketStatus)} disabled={pending}>
            <SelectTrigger id="status" className="w-40 capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TICKET_STATUSES.map((option) => (
                <SelectItem key={option} value={option} className="capitalize">
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {canReassign ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="assignee">Assignee</Label>
            <Select
              value={ticket.assignee?.id ?? 'unassigned'}
              onValueChange={reassign}
              disabled={pending}
            >
              <SelectTrigger id="assignee" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Assignee</span>
            <p className="py-2 text-sm text-muted-foreground">
              {ticket.assignee?.name ?? 'Unassigned'}
            </p>
          </div>
        )}

        <span aria-live="polite" className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving…
            </>
          ) : null}
        </span>
      </section>

      <section aria-label="Timeline" className="flex flex-col gap-4">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Timeline
        </h2>

        <ol className="relative flex flex-col gap-4 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-px before:bg-border">
          {events.map((event, index) => {
            const Icon = EVENT_ICON[event.type];
            return (
              <li
                key={event.id}
                className="animate-rise relative flex gap-4"
                style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
              >
                <span
                  className={`z-10 mt-1 grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-background ${EVENT_TONE[event.type]}`}
                >
                  <Icon className="size-4" />
                </span>

                <Card
                  className={`surface flex-1 ${event.pending ? 'animate-pulse border-dashed opacity-70' : ''}`}
                >
                  <CardContent className="py-4">
                    <p className="text-sm font-medium">{describe(event)}</p>
                    {event.type === 'created' ? (
                      <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">
                        {ticket.body}
                      </p>
                    ) : null}
                    {event.type === 'replied' ? (
                      <p className="mt-2 text-sm whitespace-pre-wrap">
                        {String(event.payload.body ?? '')}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {event.pending ? 'Sending…' : <TimeStamp iso={event.createdAt} />}
                    </p>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ol>
      </section>

      <Card className="surface">
        <CardContent className="pt-6">
          <form onSubmit={submitReply} className="flex flex-col gap-3">
            <Label htmlFor="body">Reply to the customer</Label>
            <Textarea
              id="body"
              name="body"
              rows={4}
              required
              placeholder="Write a reply the customer will see on their status page…"
            />
            <Button type="submit" disabled={pending} className="self-start">
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  Send reply
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
