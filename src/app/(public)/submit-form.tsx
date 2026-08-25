'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { z } from 'zod';
import { createTicketSchema } from '@/server/validation/schemas';
import { TICKET_PRIORITIES } from '@/types';

type Values = z.input<typeof createTicketSchema>;

const PRIORITY_LABEL: Record<(typeof TICKET_PRIORITIES)[number], string> = {
  low: 'Low — a question or minor annoyance',
  medium: 'Medium — something is harder than it should be',
  high: 'High — an important workflow is blocked',
  urgent: 'Urgent — the service is unusable',
};

const field =
  'w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-600 aria-invalid:border-red-500 dark:border-white/20';

export function SubmitForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: { customerName: '', customerEmail: '', subject: '', body: '', priority: 'medium' },
  });

  async function onSubmit(values: Values) {
    setFormError(null);
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      const payload = (await response.json().catch(() => null)) as
        | { ticketId?: string; error?: { message?: string } }
        | null;

      if (!response.ok || !payload?.ticketId) {
        setFormError(payload?.error?.message ?? 'Could not submit your ticket. Please try again.');
        setFocus('customerName');
        return;
      }

      router.push(`/submitted?id=${encodeURIComponent(payload.ticketId)}`);
    } catch {
      setFormError('Could not reach the server. Check your connection and try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
      <div aria-live="polite" role="status">
        {formError ? (
          <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            {formError}
          </p>
        ) : null}
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="customerName" className="text-sm font-medium">Your name</label>
          <input
            id="customerName" autoComplete="name" className={field}
            aria-invalid={errors.customerName ? true : undefined}
            aria-describedby={errors.customerName ? 'customerName-error' : undefined}
            {...register('customerName')}
          />
          {errors.customerName ? (
            <p id="customerName-error" className="text-sm text-red-700 dark:text-red-300">{errors.customerName.message}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="customerEmail" className="text-sm font-medium">Email</label>
          <input
            id="customerEmail" type="email" autoComplete="email" className={field}
            aria-invalid={errors.customerEmail ? true : undefined}
            aria-describedby={errors.customerEmail ? 'customerEmail-error' : 'customerEmail-hint'}
            {...register('customerEmail')}
          />
          {errors.customerEmail ? (
            <p id="customerEmail-error" className="text-sm text-red-700 dark:text-red-300">{errors.customerEmail.message}</p>
          ) : (
            <p id="customerEmail-hint" className="text-xs opacity-60">You will need this to check the ticket later.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="subject" className="text-sm font-medium">Subject</label>
        <input
          id="subject" className={field}
          aria-invalid={errors.subject ? true : undefined}
          aria-describedby={errors.subject ? 'subject-error' : undefined}
          {...register('subject')}
        />
        {errors.subject ? (
          <p id="subject-error" className="text-sm text-red-700 dark:text-red-300">{errors.subject.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="body" className="text-sm font-medium">What is happening?</label>
        <textarea
          id="body" rows={6} className={`${field} resize-y`}
          aria-invalid={errors.body ? true : undefined}
          aria-describedby={errors.body ? 'body-error' : undefined}
          {...register('body')}
        />
        {errors.body ? (
          <p id="body-error" className="text-sm text-red-700 dark:text-red-300">{errors.body.message}</p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="priority" className="text-sm font-medium">Priority</label>
        <select id="priority" className={field} {...register('priority')}>
          {TICKET_PRIORITIES.map((p) => (
            <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="self-start rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:opacity-60"
      >
        {isSubmitting ? 'Submitting…' : 'Submit ticket'}
      </button>
    </form>
  );
}
