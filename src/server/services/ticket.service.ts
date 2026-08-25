import { Types } from 'mongoose';
import { Ticket, type TicketDoc } from '../db/models';
import { scopeTicketQuery, type AuthUser } from '../auth/guards';
import { notFound } from '../errors';

/**
 * Every function here composes `scopeTicketQuery`. The scope filter is always
 * spread LAST, so a caller-supplied filter can never widen it — an agent
 * passing `assigneeId=<someone else>` still has their own id forced back on
 * top of it.
 */

export interface ListOptions {
  page: number;
  limit: number;
  filters?: Record<string, unknown>;
}

export interface ListResult {
  items: TicketDoc[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function listTicketsForUser(
  user: AuthUser,
  { page, limit, filters = {} }: ListOptions,
): Promise<ListResult> {
  const query = { ...filters, ...scopeTicketQuery(user) };

  const [items, total] = await Promise.all([
    Ticket.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<TicketDoc[]>(),
    // The count is scoped too. Counting the unscoped set would leak the
    // existence of other agents' tickets through the pagination total.
    Ticket.countDocuments(query),
  ]);

  return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

export async function countTicketsForUser(
  user: AuthUser,
  filters: Record<string, unknown> = {},
): Promise<number> {
  return Ticket.countDocuments({ ...filters, ...scopeTicketQuery(user) });
}

/**
 * Throws `NOT_FOUND` both when the ticket does not exist and when it exists
 * but belongs to another agent. Returning 403 for the second case would
 * confirm the id is real, letting an agent probe the ticket space.
 */
export async function getTicketForUser(id: string, user: AuthUser): Promise<TicketDoc> {
  if (!Types.ObjectId.isValid(id)) throw notFound('Ticket not found.');

  const ticket = await Ticket.findOne({
    _id: new Types.ObjectId(id),
    ...scopeTicketQuery(user),
  }).lean<TicketDoc>();

  if (!ticket) throw notFound('Ticket not found.');
  return ticket;
}
