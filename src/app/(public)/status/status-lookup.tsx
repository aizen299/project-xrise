'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { statusLookupSchema } from '@/server/validation/schemas';
import { DataState } from '@/components/common/data-state';
import type { TicketPriority, TicketStatus } from '@/types';

type Values = z.input<typeof statusLookupSchema>;

interface PublicStatus {
  ticketId: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  latestReply: { body: string; authorName: string; createdAt: string } | null;
}

const STATUS_STYLE: Record<TicketStatus, string> = {
  open: 'border-blue-400 text-blue-700 dark:text-blue-300',
  pending: 'border-amber-400 text-amber-700 dark:text-amber-300',
  resolved: 'border-green-400 text-green-700 dark:text-green-300',
  closed: 'border-neutral-400 text-neutral-600 dark:text-neutral-300',
};

const field =
  'w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-600 aria-invalid:border-red-500 dark:border-white/20';

export function StatusLookup({ initialTicketId }: { initialTicketId: string }) {
  const [result, setResult] = useState<PublicStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<Values | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(statusLookupSchema),
    defaultValues: { ticketId: initialTicketId, email: '' },
  });

  async function lookup(values: Values) {
    setLoading(true);
    setError(null);
    setLastQuery(values);
    try {
      const query = new URLSearchParams({ ticketId: values.ticketId, email: values.email });
      const response = await fetch(`/api/tickets/status?${query.toString()}`);
      const payload = (await response.json().catch(() => null)) as
        | { ticket?: PublicStatus; error?: { message?: string } }
        | null;

      if (!response.ok || !payload?.ticket) {
        setResult(null);
        setError(payload?.error?.message ?? 'Could not look up that ticket.');
        return;
      }
      setResult(payload.ticket);
    } catch {
      setResult(null);
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <form onSubmit={handleSubmit(lookup)} noValidate className="flex flex-col gap-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ticketId" className="text-sm font-medium">Ticket ID</label>
            <input
              id="ticketId" placeholder="XR-XXXXXXXXXX" className={`${field} font-mono`}
              aria-invalid={errors.ticketId ? true : undefined}
              aria-describedby={errors.ticketId ? 'ticketId-error' : undefined}
              {...register('ticketId')}
            />
            {errors.ticketId ? (
              <p id="ticketId-error" className="text-sm text-red-700 dark:text-red-300">{errors.ticketId.message}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input
              id="email" type="email" autoComplete="email" className={field}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'email-error' : undefined}
              {...register('email')}
            />
            {errors.email ? (
              <p id="email-error" className="text-sm text-red-700 dark:text-red-300">{errors.email.message}</p>
            ) : null}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="self-start rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-60"
        >
          {loading ? 'Looking up…' : 'Check status'}
        </button>
      </form>

      <DataState
        loading={loading}
        error={error}
        data={result}
        loadingFallback="Looking up your ticket…"
        onRetry={lastQuery ? () => void lookup(lastQuery) : undefined}
      >
        {(ticket) => (
          <section aria-label="Ticket status" className="flex flex-col gap-5 rounded-lg border border-black/10 p-6 dark:border-white/15">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs uppercase tracking-wide opacity-60">{ticket.ticketId}</p>
                <h2 className="mt-1 text-lg font-medium">{ticket.subject}</h2>
              </div>
              <span className={`ml-auto shrink-0 rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-wide ${STATUS_STYLE[ticket.status]}`}>
                {ticket.status}
              </span>
            </div>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="opacity-60">Priority</dt>
                <dd className="mt-0.5 capitalize">{ticket.priority}</dd>
              </div>
              <div>
                <dt className="opacity-60">Submitted</dt>
                <dd className="mt-0.5">
                  {new Date(ticket.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                </dd>
              </div>
            </dl>

            <div className="border-t border-black/10 pt-4 dark:border-white/15">
              <h3 className="text-sm font-medium">Latest reply</h3>
              {ticket.latestReply ? (
                <div className="mt-2">
                  <p className="text-sm whitespace-pre-wrap">{ticket.latestReply.body}</p>
                  <p className="mt-2 text-xs opacity-60">
                    {ticket.latestReply.authorName} ·{' '}
                    {new Date(ticket.latestReply.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                  </p>
                </div>
              ) : (
                <p className="mt-2 text-sm opacity-70">
                  No agent has replied yet. You will see their response here.
                </p>
              )}
            </div>
          </section>
        )}
      </DataState>
    </div>
  );
}
