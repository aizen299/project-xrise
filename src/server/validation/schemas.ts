import { z } from 'zod';
import { TICKET_PRIORITIES, TICKET_STATUSES } from '../../types';

/**
 * One definition per input, used by the Route Handler to validate and by the
 * form to infer its types. Shared shape is the main reason the API and the UI
 * live in the same project.
 *
 * NOTE: unlike the rest of `src/server/**`, this module is deliberately
 * isomorphic — client components import it too. It contains only schema
 * declarations: no secrets, no database access, nothing server-only.
 */

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email('Enter a valid email address.')),
  password: z.string().min(1, 'Password is required.'),
});
export type LoginInput = z.infer<typeof loginSchema>;

/** Pagination guard: an unbounded `limit` is a free collection scan. */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

export const ticketStatusSchema = z.enum(TICKET_STATUSES);
export const ticketPrioritySchema = z.enum(TICKET_PRIORITIES);

/** Public ticket submission (REQ-007). */
export const createTicketSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(1, 'Your name is required.')
    .max(120, 'Name must be 120 characters or fewer.'),
  customerEmail: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email('Enter a valid email address.')),
  subject: z
    .string()
    .trim()
    .min(3, 'Subject must be at least 3 characters.')
    .max(200, 'Subject must be 200 characters or fewer.'),
  body: z
    .string()
    .trim()
    .min(10, 'Please describe the issue in at least 10 characters.')
    .max(5000, 'Description must be 5000 characters or fewer.'),
  priority: ticketPrioritySchema.default('medium'),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

/** Public status lookup (REQ-008). Ticket IDs are stored uppercase. */
export const statusLookupSchema = z.object({
  ticketId: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, 'Ticket ID is required.')
    .max(32, 'That does not look like a ticket ID.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email('Enter the email address you used on the ticket.')),
});
export type StatusLookupInput = z.infer<typeof statusLookupSchema>;
