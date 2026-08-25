import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearTestDb, startTestDb, stopTestDb } from '../helpers/db';
import { Ticket, TicketEvent, User } from '../../src/server/db/models';
import { createTicket, getPublicTicketStatus } from '../../src/server/services/ticket.service';
import { createTicketSchema, statusLookupSchema } from '../../src/server/validation/schemas';
import type { AppError } from '../../src/server/errors';

const VALID = {
  customerName: 'Priya Raman',
  customerEmail: 'priya@example.com',
  subject: 'Cannot reset my password',
  body: 'The reset link says the token has expired every single time.',
  priority: 'high' as const,
};

async function rejection(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
    throw new Error('Expected a rejection.');
  } catch (error) {
    return error as AppError;
  }
}

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

describe('ticket submission (REQ-007)', () => {
  it('returns a ticket id and nothing else', async () => {
    const result = await createTicket(VALID);
    expect(Object.keys(result)).toEqual(['ticketId']);
    expect(result.ticketId).toMatch(/^XR-[2-9A-HJKMNP-Z]{10}$/);
  });

  it('opens the timeline with exactly one created event', async () => {
    const { ticketId } = await createTicket(VALID);
    const ticket = await Ticket.findOne({ ticketId });
    const events = await TicketEvent.find({ ticketId: ticket!._id });

    expect(events).toHaveLength(1);
    expect(events[0]!.type).toBe('created');
    expect(events[0]!.actor.kind).toBe('customer');
    expect(events[0]!.actor.name).toBe(VALID.customerName);
  });

  it('starts unassigned and open', async () => {
    const { ticketId } = await createTicket(VALID);
    const ticket = await Ticket.findOne({ ticketId });

    expect(ticket!.status).toBe('open');
    expect(ticket!.assigneeId).toBeNull();
    expect(ticket!.lastAgentReply).toBeNull();
  });

  it('writes the ticket and its event atomically', async () => {
    
    await createTicket(VALID);
    expect(await Ticket.countDocuments({})).toBe(1);
    expect(await TicketEvent.countDocuments({ type: 'created' })).toBe(1);
  });

  it('rolls the ticket back if the timeline write fails', async () => {
    
    const spy = vi
      .spyOn(TicketEvent, 'create')
      .mockRejectedValueOnce(new Error('simulated timeline failure'));

    await expect(createTicket(VALID)).rejects.toThrow('simulated timeline failure');

    expect(await Ticket.countDocuments({})).toBe(0);
    expect(await TicketEvent.countDocuments({})).toBe(0);
    spy.mockRestore();
  });

  it('issues a distinct id per submission', async () => {
    const ids = await Promise.all([createTicket(VALID), createTicket(VALID), createTicket(VALID)]);
    expect(new Set(ids.map((i) => i.ticketId)).size).toBe(3);
  });
});

describe('submission validation (REQ-028)', () => {
  it('accepts a well-formed ticket and normalises the email', () => {
    const parsed = createTicketSchema.parse({ ...VALID, customerEmail: '  Priya@Example.COM ' });
    expect(parsed.customerEmail).toBe('priya@example.com');
  });

  it('defaults priority to medium', () => {
    const withoutPriority = {
      customerName: VALID.customerName,
      customerEmail: VALID.customerEmail,
      subject: VALID.subject,
      body: VALID.body,
    };
    expect(createTicketSchema.parse(withoutPriority).priority).toBe('medium');
  });

  it('rejects every malformed field with a field-level message', () => {
    const result = createTicketSchema.safeParse({
      customerName: '',
      customerEmail: 'not-an-email',
      subject: 'x',
      body: 'too short',
      priority: 'catastrophic',
    });

    expect(result.success).toBe(false);
    const paths = result.error!.issues.map((i) => i.path.join('.')).sort();
    expect(paths).toEqual(['body', 'customerEmail', 'customerName', 'priority', 'subject']);
  });

  it('refuses an oversized body rather than truncating it', () => {
    const result = createTicketSchema.safeParse({ ...VALID, body: 'x'.repeat(5001) });
    expect(result.success).toBe(false);
  });
});

describe('public status check (REQ-008)', () => {
  it('returns status for a matching id and email', async () => {
    const { ticketId } = await createTicket(VALID);
    const status = await getPublicTicketStatus({ ticketId, email: VALID.customerEmail });

    expect(status).toMatchObject({ ticketId, status: 'open', priority: 'high', subject: VALID.subject });
    expect(status.latestReply).toBeNull();
  });

  it('matches the email case-insensitively', async () => {
    const { ticketId } = await createTicket(VALID);
    const parsed = statusLookupSchema.parse({ ticketId, email: 'PRIYA@EXAMPLE.COM' });
    await expect(getPublicTicketStatus(parsed)).resolves.toMatchObject({ ticketId });
  });

  it('accepts a lowercase ticket id, since customers retype it', async () => {
    const { ticketId } = await createTicket(VALID);
    const parsed = statusLookupSchema.parse({
      ticketId: ticketId.toLowerCase(),
      email: VALID.customerEmail,
    });
    await expect(getPublicTicketStatus(parsed)).resolves.toMatchObject({ ticketId });
  });

  it('gives a wrong email exactly the same error as a nonexistent ticket', async () => {
    const { ticketId } = await createTicket(VALID);

    const wrongEmail = await rejection(
      getPublicTicketStatus({ ticketId, email: 'attacker@example.com' }),
    );
    const noSuchTicket = await rejection(
      getPublicTicketStatus({ ticketId: 'XR-2222222222', email: VALID.customerEmail }),
    );

    
    expect(wrongEmail.code).toBe('NOT_FOUND');
    expect(wrongEmail.message).toBe(noSuchTicket.message);
    expect(wrongEmail.status).toBe(noSuchTicket.status);
  });

  it('never exposes internal fields to an anonymous caller', async () => {
    const agent = await User.create({
      email: 'agent@xriseai.com', name: 'Agent', role: 'agent', passwordHash: 'x',
    });
    const { ticketId } = await createTicket(VALID);
    await Ticket.updateOne({ ticketId }, { assigneeId: agent._id });

    const status = await getPublicTicketStatus({ ticketId, email: VALID.customerEmail });

        
    expect(Object.keys(status).sort()).toEqual([
      'createdAt', 'latestReply', 'priority', 'status', 'subject', 'ticketId',
    ]);
    const serialised = JSON.stringify(status);
    expect(serialised).not.toContain(agent._id.toString());
    expect(serialised).not.toContain(VALID.customerEmail);
    expect(serialised).not.toContain(VALID.body);
  });

  it('surfaces the latest agent reply once one exists', async () => {
    const { ticketId } = await createTicket(VALID);
    await Ticket.updateOne(
      { ticketId },
      { lastAgentReply: { body: 'We have reset it for you.', authorName: 'Agent One', createdAt: new Date() } },
    );

    const status = await getPublicTicketStatus({ ticketId, email: VALID.customerEmail });
    expect(status.latestReply).toMatchObject({
      body: 'We have reset it for you.',
      authorName: 'Agent One',
    });
  });
});
