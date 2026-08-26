'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Loader2, Send } from 'lucide-react';
import type { z } from 'zod';
import { createTicketSchema } from '@/server/validation/schemas';
import { TICKET_PRIORITIES } from '@/types';
import { Field } from '@/components/common/field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Values = z.input<typeof createTicketSchema>;

const PRIORITY_LABEL: Record<(typeof TICKET_PRIORITIES)[number], string> = {
  low: 'Low — a question or minor annoyance',
  medium: 'Medium — harder than it should be',
  high: 'High — an important workflow is blocked',
  urgent: 'Urgent — the service is unusable',
};

export function SubmitForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(createTicketSchema),
    defaultValues: {
      customerName: '',
      customerEmail: '',
      subject: '',
      body: '',
      priority: 'medium',
    },
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
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <div aria-live="polite" role="status">
        {formError ? (
          <div className="animate-pop flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/8 px-3.5 py-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{formError}</p>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field htmlFor="customerName" label="Your name" error={errors.customerName?.message}>
          <Input
            id="customerName"
            autoComplete="name"
            placeholder="Jordan Ellis"
            aria-invalid={errors.customerName ? true : undefined}
            aria-describedby={errors.customerName ? 'customerName-error' : undefined}
            {...register('customerName')}
          />
        </Field>

        <Field
          htmlFor="customerEmail"
          label="Email"
          error={errors.customerEmail?.message}
          hint="You will need this to check the ticket later."
        >
          <Input
            id="customerEmail"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            aria-invalid={errors.customerEmail ? true : undefined}
            aria-describedby={errors.customerEmail ? 'customerEmail-error' : 'customerEmail-hint'}
            {...register('customerEmail')}
          />
        </Field>
      </div>

      <Field htmlFor="subject" label="Subject" error={errors.subject?.message}>
        <Input
          id="subject"
          placeholder="Short summary of the problem"
          aria-invalid={errors.subject ? true : undefined}
          aria-describedby={errors.subject ? 'subject-error' : undefined}
          {...register('subject')}
        />
      </Field>

      <Field htmlFor="body" label="What is happening?" error={errors.body?.message}>
        <Textarea
          id="body"
          rows={6}
          placeholder="Include what you expected, what happened instead, and anything you already tried."
          aria-invalid={errors.body ? true : undefined}
          aria-describedby={errors.body ? 'body-error' : undefined}
          {...register('body')}
        />
      </Field>

      <Controller
        control={control}
        name="priority"
        render={({ field }) => (
          <Field htmlFor="priority" label="Priority">
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="priority" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TICKET_PRIORITIES.map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {PRIORITY_LABEL[priority]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
      />

      <Button type="submit" size="lg" disabled={isSubmitting} className="self-start">
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Submitting…
          </>
        ) : (
          <>
            <Send className="size-4" />
            Submit ticket
          </>
        )}
      </Button>
    </form>
  );
}
