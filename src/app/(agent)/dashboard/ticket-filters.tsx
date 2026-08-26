'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { TICKET_PRIORITIES, TICKET_STATUSES } from '@/types';
import type { AssignableAgent } from '@/server/services/agent.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ANY = '__any__';

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
      if (value && value !== ANY) merged.set(key, value);
      else merged.delete(key);
    }
    merged.delete('page');
    startTransition(() => router.push(`/dashboard?${merged.toString()}`));
  }

  const hasFilters = ['status', 'priority', 'assigneeId', 'q'].some((key) => params.get(key));

  return (
    <section
      aria-label="Filters"
      className="glass flex flex-col gap-4 rounded-xl p-4 sm:flex-row sm:flex-wrap sm:items-end"
    >
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get('q');
          apply({ q: typeof value === 'string' ? value.trim() : '' });
        }}
        className="flex min-w-64 flex-1 flex-col gap-2"
      >
        <Label htmlFor="q">Search</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              key={currentSearch}
              id="q"
              name="q"
              type="search"
              defaultValue={currentSearch}
              placeholder="Subject or description"
              className="pl-9"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </div>
      </form>

      <div className="flex flex-col gap-2">
        <Label htmlFor="status">Status</Label>
        <Select
          value={params.get('status') ?? ANY}
          onValueChange={(value) => apply({ status: value })}
        >
          <SelectTrigger id="status" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All statuses</SelectItem>
            {TICKET_STATUSES.map((status) => (
              <SelectItem key={status} value={status} className="capitalize">
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="priority">Priority</Label>
        <Select
          value={params.get('priority') ?? ANY}
          onValueChange={(value) => apply({ priority: value })}
        >
          <SelectTrigger id="priority" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>All priorities</SelectItem>
            {TICKET_PRIORITIES.map((priority) => (
              <SelectItem key={priority} value={priority} className="capitalize">
                {priority}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {canFilterByAssignee ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="assigneeId">Assignee</Label>
          <Select
            value={params.get('assigneeId') ?? ANY}
            onValueChange={(value) => apply({ assigneeId: value })}
          >
            <SelectTrigger id="assigneeId" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Anyone</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => startTransition(() => router.push('/dashboard'))}
          >
            <X className="size-4" />
            Clear
          </Button>
        ) : null}
        <span aria-live="polite" className="text-sm text-muted-foreground">
          {pending ? <Loader2 className="size-4 animate-spin" aria-label="Updating" /> : null}
        </span>
      </div>
    </section>
  );
}
