import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { clearTestDb, startTestDb, stopTestDb } from '../helpers/db';
import { Ticket, User } from '../../src/server/db/models';
import { generateTicketId } from '../../src/lib/ticket-id';
import {
  requireAuth,
  requireRole,
  scopeTicketQuery,
  type AuthUser,
} from '../../src/server/auth/guards';
import {
  countTicketEventsSince,
  countTicketsForUser,
  getTicketForUser,
  listTicketsForUser,
} from '../../src/server/services/ticket.service';
import { AppError } from '../../src/server/errors';



let agentA: AuthUser;
let agentB: AuthUser;
let admin: AuthUser;
let ticketOfA: string;
let ticketOfB: string;
let unassignedTicket: string;

beforeAll(startTestDb);
afterAll(stopTestDb);

beforeEach(async () => {
  await clearTestDb();

  const [a, b, adm] = await User.create([
    { email: 'a@xriseai.com', name: 'Agent A', role: 'agent', passwordHash: 'x' },
    { email: 'b@xriseai.com', name: 'Agent B', role: 'agent', passwordHash: 'x' },
    { email: 'admin@xriseai.com', name: 'Admin', role: 'admin', passwordHash: 'x' },
  ]);

  agentA = { sub: a._id.toString(), role: 'agent', name: a.name, email: a.email };
  agentB = { sub: b._id.toString(), role: 'agent', name: b.name, email: b.email };
  admin = { sub: adm._id.toString(), role: 'admin', name: adm.name, email: adm.email };

  const base = { customerName: 'C', customerEmail: 'c@example.com', body: 'b' };
  const [ta, tb, tu] = await Ticket.create([
    { ticketId: generateTicketId(), subject: 'belongs to A', assigneeId: a._id, ...base },
    { ticketId: generateTicketId(), subject: 'belongs to B', assigneeId: b._id, ...base },
    { ticketId: generateTicketId(), subject: 'unassigned', assigneeId: null, ...base },
  ]);
  ticketOfA = ta._id.toString();
  ticketOfB = tb._id.toString();
  unassignedTicket = tu._id.toString();
});

describe('scopeTicketQuery', () => {
  it('returns an unrestricted filter for an admin', () => {
    expect(scopeTicketQuery(admin)).toEqual({});
  });

  it('pins an agent to their own assigned tickets', () => {
    expect(scopeTicketQuery(agentA)).toEqual({ assigneeId: new Types.ObjectId(agentA.sub) });
  });
});

describe('cross-agent access (REQ-018)', () => {
  it('denies agent A direct access to agent B’s ticket by id', async () => {
    await expect(getTicketForUser(ticketOfB, agentA)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('reports the denial as NOT_FOUND, never FORBIDDEN', async () => {
    // A 403 would confirm the id is real, letting an agent probe for the
    // existence of other agents' tickets.
    const outOfScope = await getTicketForUser(ticketOfB, agentA).catch((e: AppError) => e);
    const nonexistent = await getTicketForUser(new Types.ObjectId().toString(), agentA).catch(
      (e: AppError) => e,
    );

    expect((outOfScope as AppError).code).toBe('NOT_FOUND');
    expect((outOfScope as AppError).message).toBe((nonexistent as AppError).message);
    expect((outOfScope as AppError).status).toBe((nonexistent as AppError).status);
  });

  it('hides unassigned tickets from agents but shows them to admins', async () => {
    await expect(getTicketForUser(unassignedTicket, agentA)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(getTicketForUser(unassignedTicket, admin)).resolves.toMatchObject({
      subject: 'unassigned',
    });
  });

  it('lets each agent reach their own ticket', async () => {
    await expect(getTicketForUser(ticketOfA, agentA)).resolves.toMatchObject({ subject: 'belongs to A' });
    await expect(getTicketForUser(ticketOfB, agentB)).resolves.toMatchObject({ subject: 'belongs to B' });
  });

  it('lets an admin reach every ticket', async () => {
    for (const id of [ticketOfA, ticketOfB, unassignedTicket]) {
      await expect(getTicketForUser(id, admin)).resolves.toBeTruthy();
    }
  });

  it('treats a malformed id as not found rather than crashing', async () => {
    await expect(getTicketForUser('not-an-object-id', agentA)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('live update stream scoping', () => {
  it('lets an agent watch their own ticket', async () => {
    await expect(countTicketEventsSince(ticketOfA, agentA, new Date(0))).resolves.toBeTypeOf('number');
  });

  it('refuses to stream another agent\u2019s ticket', async () => {
    // The SSE endpoint polls through this function, so scope is enforced on
    // every poll rather than only when the connection opens.
    await expect(countTicketEventsSince(ticketOfB, agentA, new Date(0))).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('refuses to stream an unassigned ticket for an agent but allows an admin', async () => {
    await expect(countTicketEventsSince(unassignedTicket, agentA, new Date(0))).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(countTicketEventsSince(unassignedTicket, admin, new Date(0))).resolves.toBeTypeOf('number');
  });
});

describe('scoped listing', () => {
  it('returns only the requesting agent’s tickets', async () => {
    const result = await listTicketsForUser(agentA, { page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.subject).toBe('belongs to A');
  });

  it('scopes the pagination total, not just the rows', async () => {
    // The subtle leak: scoping the returned rows but counting the whole
    // collection tells an agent how many tickets exist that they cannot see.
    const result = await listTicketsForUser(agentA, { page: 1, limit: 20 });
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);

    const adminResult = await listTicketsForUser(admin, { page: 1, limit: 20 });
    expect(adminResult.total).toBe(3);
  });

  it('scopes countTicketsForUser as well', async () => {
    expect(await countTicketsForUser(agentA)).toBe(1);
    expect(await countTicketsForUser(agentB)).toBe(1);
    expect(await countTicketsForUser(admin)).toBe(3);
  });

  it('refuses to let a caller-supplied filter widen the scope', async () => {
    
    const result = await listTicketsForUser(agentA, {
      page: 1,
      limit: 20,
      filters: { assigneeId: new Types.ObjectId(agentB.sub) },
    });
    expect(result.items.every((t) => t.subject === 'belongs to A')).toBe(true);
    expect(result.total).toBe(1);
  });

  it('still lets an admin filter by a specific assignee', async () => {
    const result = await listTicketsForUser(admin, {
      page: 1,
      limit: 20,
      filters: { assigneeId: new Types.ObjectId(agentB.sub) },
    });
    expect(result.total).toBe(1);
    expect(result.items[0]?.subject).toBe('belongs to B');
  });
});

describe('role guards', () => {
  it('rejects an anonymous caller', () => {
    expect(() => requireAuth(null)).toThrowError(expect.objectContaining({ code: 'UNAUTHORIZED' }));
  });

  it('lets an admin through an admin-only gate', () => {
    expect(requireRole(admin, 'admin')).toBe(admin);
  });

  it('blocks an agent from an admin-only gate with FORBIDDEN', () => {
    
    expect(() => requireRole(agentA, 'admin')).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('admits both roles where both are allowed', () => {
    expect(requireRole(agentA, 'agent', 'admin')).toBe(agentA);
    expect(requireRole(admin, 'agent', 'admin')).toBe(admin);
  });
});
