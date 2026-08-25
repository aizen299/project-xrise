import { z } from 'zod';
import { TICKET_PRIORITIES, TICKET_STATUSES } from '../../types';

/**
 * One definition per input, used by the Route Handler to validate and by the
 * form to infer its types. Shared shape is the main reason the API and the UI
 * live in the same project.
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
