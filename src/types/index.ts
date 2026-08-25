/**
 * Domain vocabulary shared by the database models, the validation schemas and
 * the UI. Declared as `as const` tuples so a single definition yields both the
 * runtime list (for Mongoose enums, Zod enums and <Select> options) and the
 * TypeScript union.
 */

export const TICKET_STATUSES = ['open', 'pending', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const USER_ROLES = ['agent', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Exactly the four timeline events named in the assignment (REQ-013). */
export const TICKET_EVENT_TYPES = [
  'created',
  'replied',
  'status_changed',
  'reassigned',
] as const;
export type TicketEventType = (typeof TICKET_EVENT_TYPES)[number];

export const ACTOR_KINDS = ['customer', 'agent', 'system'] as const;
export type ActorKind = (typeof ACTOR_KINDS)[number];
