'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Search } from 'lucide-react';
import type { z } from 'zod';
import { statusLookupSchema } from '@/server/validation/schemas';
import { DataState } from '@/components/common/data-state';
import { Field } from '@/components/common/field';
import { StatusBadge, PriorityBadge } from '@/components/tickets/badges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
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

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

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
      <Card className="animate-rise surface">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit(lookup)} noValidate className="flex flex-col gap-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field htmlFor="ticketId" label="Ticket ID" error={errors.ticketId?.message}>
                <Input
                  id="ticketId"
                  placeholder="XR-XXXXXXXXXX"
                  className="font-mono tracking-wider"
                  aria-invalid={errors.ticketId ? true : undefined}
                  aria-describedby={errors.ticketId ? 'ticketId-error' : undefined}
                  {...register('ticketId')}
                />
              </Field>

              <Field htmlFor="email" label="Email" error={errors.email?.message}>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  aria-invalid={errors.email ? true : undefined}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  {...register('email')}
                />
              </Field>
            </div>

            <Button type="submit" disabled={loading} className="self-start">
              {loading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Looking up…
                </>
              ) : (
                <>
                  <Search className="size-4" />
                  Check status
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <DataState
        loading={loading}
        error={error}
        data={result}
        loadingFallback={
          <Card className="surface">
            <CardContent className="flex flex-col gap-3 pt-6">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-6 w-2/3" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        }
        onRetry={lastQuery ? () => void lookup(lastQuery) : undefined}
      >
        {(ticket) => (
          <section aria-label="Ticket status" className="animate-rise">
            <Card className="surface">
              <CardContent className="flex flex-col gap-5 pt-6">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs tracking-wider text-muted-foreground">
                      {ticket.ticketId}
                    </p>
                    <h2 className="mt-1 text-lg font-medium text-balance">{ticket.subject}</h2>
                  </div>
                  <div className="ml-auto flex shrink-0 gap-2">
                    <StatusBadge status={ticket.status} />
                    <PriorityBadge priority={ticket.priority} />
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  Submitted {formatWhen(ticket.createdAt)}
                </p>

                <Separator />

                <div>
                  <h3 className="text-sm font-medium">Latest reply</h3>
                  {ticket.latestReply ? (
                    <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
                      <p className="text-sm whitespace-pre-wrap">{ticket.latestReply.body}</p>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {ticket.latestReply.authorName} · {formatWhen(ticket.latestReply.createdAt)}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No agent has replied yet. Their response will appear here.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>
        )}
      </DataState>
    </div>
  );
}
