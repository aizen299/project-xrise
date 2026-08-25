import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Types } from 'mongoose';
import { clearTestDb, startTestDb, stopTestDb } from '../helpers/db';
import { Ticket, User } from '../../src/server/db/models';
import { generateTicketId } from '../../src/lib/ticket-id';
import {
  explainTicketList,
  listTickets,
} from '../../src/server/services/ticket.service';
import { ticketListQuerySchema } from '../../src/server/validation/schemas';
import type { AuthUser } from '../../src/server/auth/guards';
import type { TicketPriority, TicketStatus } from '../../src/types';

let agentA: AuthUser;
let agentB: AuthUser;
let admin: AuthUser;
let agentAId: Types.ObjectId;
let agentBId: Types.ObjectId;

const defaults = ticketListQuerySchema.parse({});

function query(overrides: Partial<typeof defaults> = {}) {
  return { ...defaults, ...overrides };
}

function collectStages(plan: unknown, found: string[] = []): string[] {
  if (plan && typeof plan === 'object') {
    const node = plan as Record<string, unknown>;
    if (typeof node.stage === 'string') found.push(node.stage);
    for (const value of Object.values(node)) collectStages(value, found);
  }
  return found;
}

async function seedTicket(opts: {
  subject: string;
  body?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  assigneeId?: Types.ObjectId | null;
}) {
  return Ticket.create({
    ticketId: generateTicketId(),
    customerName: 'Customer',
    customerEmail: 'customer@example.com',
    subject: opts.subject,
    body: opts.body ?? 'Some description of the problem.',
    status: opts.status ?? 'open',
    priority: opts.priority ?? 'medium',
    assigneeId: opts.assigneeId ?? null,
  });
}

beforeAll(startTestDb);
afterAll(stopTestDb);

beforeEach(async () => {
  await clearTestDb();
  const [a, b, adm] = await User.create([
    { email: 'a@xriseai.com', name: 'Agent A', role: 'agent', passwordHash: 'x' },
    { email: 'b@xriseai.com', name: 'Agent B', role: 'agent', passwordHash: 'x' },
    { email: 'admin@xriseai.com', name: 'Admin', role: 'admin', passwordHash: 'x' },
  ]);
  agentAId = a._id;
  agentBId = b._id;
  agentA = { sub: a._id.toString(), role: 'agent', name: a.name, email: a.email };
  agentB = { sub: b._id.toString(), role: 'agent', name: b.name, email: b.email };
  admin = { sub: adm._id.toString(), role: 'admin', name: adm.name, email: adm.email };

  await seedTicket({ subject: 'Printer jams constantly', status: 'open', priority: 'high', assigneeId: agentAId });
  await seedTicket({ subject: 'Cannot log in', status: 'pending', priority: 'urgent', assigneeId: agentAId });
  await seedTicket({ subject: 'Invoice missing', status: 'closed', priority: 'low', assigneeId: agentAId });
  await seedTicket({ subject: 'Database timeout errors', body: 'The database keeps timing out.', status: 'open', priority: 'urgent', assigneeId: agentBId });
  await seedTicket({ subject: 'Feature request', status: 'open', priority: 'low', assigneeId: null });
});

describe('filters (REQ-011)', () => {
  it('filters by status', async () => {
    const result = await listTickets(admin, query({ status: 'open' }));
    expect(result.total).toBe(3);
    expect(result.rows.every((r) => r.status === 'open')).toBe(true);
  });

  it('filters by priority', async () => {
    const result = await listTickets(admin, query({ priority: 'urgent' }));
    expect(result.total).toBe(2);
  });

  it('lets an admin filter by a specific assignee', async () => {
    const result = await listTickets(admin, query({ assigneeId: agentBId.toString() }));
    expect(result.total).toBe(1);
    expect(result.rows[0]?.subject).toBe('Database timeout errors');
  });

  it('lets an admin filter for unassigned tickets', async () => {
    const result = await listTickets(admin, query({ assigneeId: 'unassigned' }));
    expect(result.total).toBe(1);
    expect(result.rows[0]?.assignee).toBeNull();
  });

  it('combines filters', async () => {
    const result = await listTickets(admin, query({ status: 'open', priority: 'urgent' }));
    expect(result.total).toBe(1);
    expect(result.rows[0]?.subject).toBe('Database timeout errors');
  });

  it('resolves assignee names for display', async () => {
    const result = await listTickets(admin, query({ assigneeId: agentAId.toString() }));
    expect(result.rows.every((r) => r.assignee?.name === 'Agent A')).toBe(true);
  });
});

describe('scoping still holds under filters (REQ-018)', () => {
  it('shows an agent only their own tickets', async () => {
    const result = await listTickets(agentA, query());
    expect(result.total).toBe(3);
    expect(result.rows.every((r) => r.assignee?.id === agentAId.toString())).toBe(true);
  });

  it('scopes the total, not just the rows', async () => {
    expect((await listTickets(agentB, query())).total).toBe(1);
    expect((await listTickets(admin, query())).total).toBe(5);
  });

  it('ignores an agent trying to filter by another assignee', async () => {
    const result = await listTickets(agentA, query({ assigneeId: agentBId.toString() }));
    expect(result.total).toBe(3);
    expect(result.rows.every((r) => r.assignee?.id === agentAId.toString())).toBe(true);
  });

  it('does not let an agent see unassigned tickets via the unassigned filter', async () => {
    const result = await listTickets(agentA, query({ assigneeId: 'unassigned' }));
    expect(result.rows.every((r) => r.assignee?.id === agentAId.toString())).toBe(true);
  });
});

describe('server-side search (REQ-012)', () => {
  it('matches on subject', async () => {
    const result = await listTickets(admin, query({ q: 'printer' }));
    expect(result.total).toBe(1);
    expect(result.rows[0]?.subject).toBe('Printer jams constantly');
  });

  it('matches on body', async () => {
    const result = await listTickets(admin, query({ q: 'timing' }));
    expect(result.rows.some((r) => r.subject === 'Database timeout errors')).toBe(true);
  });

  it('returns nothing for a term that appears nowhere', async () => {
    expect((await listTickets(admin, query({ q: 'zzzznotpresent' }))).total).toBe(0);
  });

  it('never lets search reach outside the caller scope', async () => {
    const asAdmin = await listTickets(admin, query({ q: 'database' }));
    expect(asAdmin.total).toBe(1);

    const asAgentA = await listTickets(agentA, query({ q: 'database' }));
    expect(asAgentA.total).toBe(0);
  });

  it('combines search with filters', async () => {
    const result = await listTickets(admin, query({ q: 'log in', status: 'pending' }));
    expect(result.rows.every((r) => r.status === 'pending')).toBe(true);
  });
});

describe('pagination (REQ-010)', () => {
  it('splits results across pages without overlap', async () => {
    const first = await listTickets(admin, query({ limit: 2, page: 1 }));
    const second = await listTickets(admin, query({ limit: 2, page: 2 }));

    expect(first.rows).toHaveLength(2);
    expect(second.rows).toHaveLength(2);
    expect(first.totalPages).toBe(3);

    const ids = new Set([...first.rows, ...second.rows].map((r) => r.id));
    expect(ids.size).toBe(4);
  });

  it('reports a consistent total on every page', async () => {
    for (const page of [1, 2, 3]) {
      expect((await listTickets(admin, query({ limit: 2, page }))).total).toBe(5);
    }
  });

  it('returns an empty page past the end rather than failing', async () => {
    const result = await listTickets(admin, query({ limit: 2, page: 99 }));
    expect(result.rows).toHaveLength(0);
    expect(result.total).toBe(5);
  });

  it('clamps limit so a caller cannot request a full scan', async () => {
    expect(ticketListQuerySchema.parse({ limit: '100000' }).limit).toBe(20);
    expect(ticketListQuerySchema.parse({ limit: '50' }).limit).toBe(50);
  });

  it('falls back to defaults for junk pagination values', () => {
    expect(ticketListQuerySchema.parse({ page: 'abc', limit: '-4' })).toMatchObject({
      page: 1,
      limit: 20,
    });
  });
});

describe('index usage (REQ-031)', () => {
  it('serves the agent dashboard query from an index, not a collection scan', async () => {
    const plan = await explainTicketList(agentA, query({ status: 'open', priority: 'high' }));
    const stages = collectStages(plan);

    expect(stages).toContain('IXSCAN');
    expect(stages).not.toContain('COLLSCAN');
  });

  it('serves the admin dashboard query from an index', async () => {
    const plan = await explainTicketList(admin, query({ status: 'open' }));
    const stages = collectStages(plan);

    expect(stages).toContain('IXSCAN');
    expect(stages).not.toContain('COLLSCAN');
  });
});
