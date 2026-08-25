import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestDb, stopTestDb } from '../helpers/db';
import { seed, type SeedSummary } from '../../scripts/seed';
import { Ticket, TicketEvent, User } from '../../src/server/db/models';
import { verifyPassword } from '../../src/server/auth/password';

let summary: SeedSummary;

beforeAll(async () => {
  await startTestDb();
  summary = await seed();
}, 120_000);
afterAll(stopTestDb);

describe('seed (REQ-005)', () => {
  it('creates the two accounts the assignment names, with distinct roles', async () => {
    const agent = await User.findOne({ email: 'agent1@xriseai.com' });
    const admin = await User.findOne({ email: 'admin@xriseai.com' });

    expect(agent?.role).toBe('agent');
    expect(admin?.role).toBe('admin');
  });

  it('stores credentials that actually authenticate', async () => {
    const agent = await User.findOne({ email: 'agent1@xriseai.com' }).select('+passwordHash');
    expect(agent).not.toBeNull();
    expect(await verifyPassword('Password123!', agent!.passwordHash)).toBe(true);
    expect(await verifyPassword('wrong', agent!.passwordHash)).toBe(false);
  });

  it('never exposes the password hash on an ordinary query', async () => {
    const agent = await User.findOne({ email: 'agent1@xriseai.com' });
    expect(agent).not.toBeNull();
    expect((agent as unknown as Record<string, unknown>).passwordHash).toBeUndefined();
  });

  it('produces data where the two agents own disjoint, non-empty ticket sets', () => {
    // Without this, the agent-vs-admin scoping split cannot be demonstrated.
    expect(summary.agent1).toBeGreaterThan(0);
    expect(summary.agent2).toBeGreaterThan(0);
    expect(summary.agent1 + summary.agent2 + summary.unassigned).toBe(summary.total);
    expect(summary.total).toBeGreaterThan(summary.agent1);
  });

  it('opens a timeline for every ticket', async () => {
    const tickets = await Ticket.countDocuments({});
    const created = await TicketEvent.countDocuments({ type: 'created' });
    expect(created).toBe(tickets);
  });

  it('gives every seeded ticket a unique public id of the documented shape', async () => {
    const ids = (await Ticket.find({}, { ticketId: 1 })).map((t) => t.ticketId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^XR-[2-9A-HJKMNP-Z]{10}$/);
  });
});
