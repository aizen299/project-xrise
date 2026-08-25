'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { TICKET_PRIORITIES, TICKET_STATUSES } from '@/types';
import type { AssignableAgent } from '@/server/services/agent.service';

const control =
  'rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-white/20';

export function TicketFilters({
  agents,
  canFilterByAssignee,
}: {
  agents: AssignableAgent[];
  canFilterByAssignee: boolean;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const currentSearch = params.get('q') ?? '';

  function apply(next: Record<string, string>) {
    const merged = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) merged.set(key, value);
      else merged.delete(key);
    }
    merged.delete('page');
    startTransition(() => router.push(`/dashboard?${merged.toString()}`));
  }

  const hasFilters = ['status', 'priority', 'assigneeId', 'q'].some((k) => params.get(k));

  return (
    <section aria-label="Filters" className="flex flex-col gap-3">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get('q');
          apply({ q: typeof value === 'string' ? value.trim() : '' });
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <div className="flex min-w-56 flex-1 flex-col gap-1.5">
          <label htmlFor="q" className="text-sm font-medium">
            Search
          </label>
          <input
            key={currentSearch}
            id="q"
            name="q"
            type="search"
            defaultValue={currentSearch}
            placeholder="Subject or description"
            className={control}
          />
        </div>
        <button
          type="submit"
          className="rounded-md border border-black/15 px-4 py-2 text-sm transition-colors hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-blue-600 dark:border-white/20 dark:hover:bg-white/10"
        >
          Search
        </button>
      </form>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="status"
            className={control}
            value={params.get('status') ?? ''}
            onChange={(event) => apply({ status: event.target.value })}
          >
            <option value="">All statuses</option>
            {TICKET_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="priority" className="text-sm font-medium">
            Priority
          </label>
          <select
            id="priority"
            className={control}
            value={params.get('priority') ?? ''}
            onChange={(event) => apply({ priority: event.target.value })}
          >
            <option value="">All priorities</option>
            {TICKET_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </div>

        {canFilterByAssignee ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="assigneeId" className="text-sm font-medium">
              Assignee
            </label>
            <select
              id="assigneeId"
              className={control}
              value={params.get('assigneeId') ?? ''}
              onChange={(event) => apply({ assigneeId: event.target.value })}
            >
              <option value="">Anyone</option>
              <option value="unassigned">Unassigned</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {hasFilters ? (
          <button
            type="button"
            onClick={() => startTransition(() => router.push('/dashboard'))}
            className="rounded-md px-3 py-2 text-sm underline underline-offset-4 hover:opacity-80 focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            Clear filters
          </button>
        ) : null}

        <span aria-live="polite" className="text-sm opacity-70">
          {pending ? 'Updating…' : ''}
        </span>
      </div>
    </section>
  );
}
