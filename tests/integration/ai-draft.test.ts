import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearTestDb, startTestDb, stopTestDb } from '../helpers/db';
import { rejection } from '../helpers/rejection';
import { Ticket, User } from '../../src/server/db/models';
import { generateTicketId } from '../../src/lib/ticket-id';
import { draftReply } from '../../src/server/services/ai.service';
import { isAiEnabled } from '../../src/server/ai/provider';
import { resetEnvCache } from '../../src/server/env';
import type { AuthUser } from '../../src/server/auth/guards';

let agentA: AuthUser;
let agentB: AuthUser;
let ticketOfB: string;

beforeAll(startTestDb);
afterAll(stopTestDb);

beforeEach(async () => {
  await clearTestDb();
  delete process.env.LLM_API_KEY;
  resetEnvCache();

  const [a, b] = await User.create([
    { email: 'a@xriseai.com', name: 'Agent A', role: 'agent', passwordHash: 'x' },
    { email: 'b@xriseai.com', name: 'Agent B', role: 'agent', passwordHash: 'x' },
  ]);
  agentA = { sub: a._id.toString(), role: 'agent', name: a.name, email: a.email };
  agentB = { sub: b._id.toString(), role: 'agent', name: b.name, email: b.email };

  const ticket = await Ticket.create({
    ticketId: generateTicketId(),
    customerName: 'Customer',
    customerEmail: 'customer@example.com',
    subject: 'Cannot log in',
    body: 'The password reset link always says the token expired.',
    assigneeId: b._id,
  });
  ticketOfB = ticket._id.toString();
});

afterEach(() => {
  delete process.env.LLM_API_KEY;
  resetEnvCache();
});

describe('AI availability', () => {
  it('reports disabled when no key is configured', () => {
    expect(isAiEnabled()).toBe(false);
  });

  it('reports enabled once a key is present', () => {
    process.env.LLM_API_KEY = 'test-key';
    resetEnvCache();
    expect(isAiEnabled()).toBe(true);
  });
});

describe('draftReply', () => {
  it('refuses with a clear message when the feature is unconfigured', async () => {
    const error = await rejection(draftReply(ticketOfB, agentB));
    expect(error.code).toBe('CONFLICT');
    expect(error.message).toMatch(/not configured/i);
  });

  it('enforces ticket scope even when the feature is configured', async () => {
    process.env.LLM_API_KEY = 'test-key';
    resetEnvCache();

    // Agent A is not assigned this ticket, so the drafting endpoint must not
    // become a way to read another agent's ticket content through the model.
    const error = await rejection(draftReply(ticketOfB, agentA));
    expect(error.code).toBe('NOT_FOUND');
  });

  it('checks configuration before touching ticket data', async () => {
    const error = await rejection(draftReply(ticketOfB, agentA));
    expect(error.code).toBe('CONFLICT');
  });
});
