import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ZodError, z } from 'zod';
import { clearTestDb, startTestDb, stopTestDb } from '../helpers/db';
import { RateLimit, Ticket, TicketEvent, User } from '../../src/server/db/models';
import { generateTicketId, isTicketIdShape } from '../../src/lib/ticket-id';
import { AppError, notFound, toErrorResponse } from '../../src/server/errors';
import { hashPassword, verifyPassword } from '../../src/server/auth/password';

beforeAll(startTestDb);
afterAll(stopTestDb);
afterEach(clearTestDb);

async function indexKeysOf(model: { collection: { indexes(): Promise<unknown[]> } }) {
  const indexes = (await model.collection.indexes()) as Array<{ name: string; key: Record<string, unknown> }>;
  return indexes.filter((i) => i.name !== '_id_').map((i) => JSON.stringify(i.key)).sort();
}

describe('database foundation', () => {
  it('registers every model against the connection', () => {
    expect([User.modelName, Ticket.modelName, TicketEvent.modelName, RateLimit.modelName]).toEqual([
      'User',
      'Ticket',
      'TicketEvent',
      'RateLimit',
    ]);
  });

  it('creates exactly the ticket indexes the dashboard queries need', async () => {
    const keys = await indexKeysOf(Ticket);
    expect(keys).toContain(JSON.stringify({ ticketId: 1 }));
    expect(keys).toContain(JSON.stringify({ assigneeId: 1, status: 1, priority: 1, createdAt: -1 }));
    expect(keys).toContain(JSON.stringify({ status: 1, priority: 1, createdAt: -1 }));
    expect(keys).toContain(JSON.stringify({ createdAt: -1 }));
    
    const raw = (await Ticket.collection.indexes()) as Array<{ name: string }>;
    expect(raw.some((i) => i.name === 'ticket_search')).toBe(true);
  });

  it('indexes the timeline by ticket and time, the only query it serves', async () => {
    expect(await indexKeysOf(TicketEvent)).toContain(JSON.stringify({ ticketId: 1, createdAt: 1 }));
  });

  it('gives the rate-limit collection a TTL index so windows self-reap', async () => {
    const indexes = (await RateLimit.collection.indexes()) as Array<{
      key: Record<string, unknown>;
      expireAfterSeconds?: number;
    }>;
    const ttl = indexes.find((i) => JSON.stringify(i.key) === JSON.stringify({ expiresAt: 1 }));
    expect(ttl?.expireAfterSeconds).toBe(0);
  });

  it('enforces unique ticket ids and agent emails', async () => {
    const id = generateTicketId();
    const base = { customerName: 'A', customerEmail: 'a@example.com', subject: 's', body: 'b' };
    await Ticket.create({ ticketId: id, ...base });
    await expect(Ticket.create({ ticketId: id, ...base })).rejects.toThrow();

    await User.create({ email: 'dup@xriseai.com', name: 'X', passwordHash: 'h' });
    await expect(User.create({ email: 'dup@xriseai.com', name: 'Y', passwordHash: 'h' })).rejects.toThrow();
  });

  it('applies the documented ticket defaults', async () => {
    const ticket = await Ticket.create({
      ticketId: generateTicketId(),
      customerName: 'Case Test',
      customerEmail: 'MixedCase@Example.COM',
      subject: 'subject',
      body: 'body',
    });
    expect(ticket.status).toBe('open');
    expect(ticket.priority).toBe('medium');
    expect(ticket.assigneeId).toBeNull();
    expect(ticket.lastAgentReply).toBeNull();
    
    expect(ticket.customerEmail).toBe('mixedcase@example.com');
  });

  it('rejects event types outside the four the assignment names', async () => {
    const ticket = await Ticket.create({
      ticketId: generateTicketId(), customerName: 'A', customerEmail: 'a@example.com', subject: 's', body: 'b',
    });
    await expect(
      TicketEvent.create({
        ticketId: ticket._id,
        
        type: 'exploded' as unknown as 'created',
        actor: { id: null, name: 'x', kind: 'agent' },
      }),
    ).rejects.toThrow();
  });
});

describe('ticket id generation', () => {
  it('produces the documented shape', () => {
    const id = generateTicketId();
    expect(id).toMatch(/^XR-[2-9A-HJKMNP-Z]{10}$/);
    expect(isTicketIdShape(id)).toBe(true);
  });

  it('omits characters that are ambiguous when read aloud or retyped', () => {
    const sample = Array.from({ length: 300 }, generateTicketId).join('');
    for (const char of ['0', 'O', '1', 'I', 'L']) {
      expect(sample.slice(3)).not.toContain(char);
    }
  });

  it('does not collide across many draws', () => {
    const ids = new Set(Array.from({ length: 5_000 }, generateTicketId));
    expect(ids.size).toBe(5_000);
  });
});

describe('error serialisation', () => {
  it('maps an AppError to its code and status', () => {
    const { status, body } = toErrorResponse(notFound('No such ticket.'), 'req_abc');
    expect(status).toBe(404);
    expect(body.error).toMatchObject({ code: 'NOT_FOUND', message: 'No such ticket.', requestId: 'req_abc' });
  });

  it('turns a ZodError into field-level validation details', () => {
    const schema = z.object({ email: z.email(), priority: z.enum(['low', 'high']) });
    const parsed = schema.safeParse({ email: 'nope', priority: 'sideways' });
    const { status, body } = toErrorResponse(parsed.error as ZodError, 'req_v');
    expect(status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details?.map((d) => d.path).sort()).toEqual(['email', 'priority']);
  });

  it('never leaks an unexpected error message to the client', () => {
    
    const password = 'n0t-a-real-password';
    const leaky = new Error(
      `${['mongodb', '+srv:', '//'].join('')}dbuser:${password}@cluster0.ab12c.mongodb.net failed`,
    );
    const { status, body } = toErrorResponse(leaky, 'req_leak');
    expect(status).toBe(500);
    expect(body.error.message).toBe('An unexpected error occurred.');
    const serialised = JSON.stringify(body);
    expect(serialised).not.toContain(password);
    expect(serialised).not.toContain('mongodb+srv');
    expect(serialised).not.toContain('stack');
  });

  it('classifies client faults as warn and server faults as error', () => {
    expect(toErrorResponse(notFound(), 'r').logLevel).toBe('warn');
    expect(toErrorResponse(new AppError('INTERNAL', 'boom'), 'r').logLevel).toBe('error');
    expect(toErrorResponse(new Error('boom'), 'r').logLevel).toBe('error');
  });
});

describe('password hashing', () => {
  it('round-trips a password and rejects the wrong one', async () => {
    const hash = await hashPassword('Password123!');
    expect(hash).not.toContain('Password123!');
    expect(await verifyPassword('Password123!', hash)).toBe(true);
    expect(await verifyPassword('Password123?', hash)).toBe(false);
  });

  it('salts, so identical passwords hash differently', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });
});
