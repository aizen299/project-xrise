import { Types } from 'mongoose';
import { forbidden, unauthorized } from '../errors';
import type { UserRole } from '../../types';
import type { SessionClaims } from './jwt';

export type AuthUser = SessionClaims;

export function requireAuth(session: SessionClaims | null): AuthUser {
  if (!session) throw unauthorized();
  return session;
}

export function requireRole(
  session: SessionClaims | null,
  ...allowed: readonly UserRole[]
): AuthUser {
  const user = requireAuth(session);
  if (!allowed.includes(user.role)) {
    throw forbidden('Your role does not permit this action.');
  }
  return user;
}

export function isAdmin(user: AuthUser): boolean {
  return user.role === 'admin';
}

/**
 * The authorization chokepoint for every ticket query in the application.
 *
 * Admins see all tickets; agents see only tickets assigned to them (REQ-018).
 * That is a data-access rule, so it is expressed as a Mongo filter and spread
 * into every read and write — list, count, search, detail, reply, status
 * change. No route handler is permitted to hand-roll the assignee condition,
 * because the one that forgets is the one that leaks.
 *
 * Note that the agent filter also excludes unassigned tickets, which is the
 * correct reading of "agents see only tickets assigned to them".
 */
export function scopeTicketQuery(user: AuthUser): Record<string, unknown> {
  if (isAdmin(user)) return {};
  return { assigneeId: new Types.ObjectId(user.sub) };
}
