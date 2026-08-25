import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Types } from 'mongoose';
import { clearTestDb, startTestDb, stopTestDb } from '../helpers/db';
import { rejection } from '../helpers/rejection';
import { Ticket, TicketEvent, User } from '../../src/server/db/models';
import { createTicket, getTicketDetail, addReply, changeTicketStatus, reassignTicket, getPublicTicketStatus } from '../../src/server/services/ticket.service';
import type { AuthUser } from '../../src/server/auth/guards';

let agentA: AuthUser;
let agentB: AuthUser;
let admin: AuthUser;
let agentAId: Types.ObjectId;
let agentBId: Types.ObjectId;
let ticketId: string;

const CUSTOMER = {
  customerName: 'Priya Raman',
  customerEmail: 'priya@example.com',
  subject: 'Cannot reset my password',
  body: 'The reset link expires immediately every time.',
  priority: 'high' as const,
};

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

  const created = await createTicket(CUSTOMER);
  const doc = await Ticket.findOneAndUpdate(
    { ticketId: created.ticketId },
    { assigneeId: agentAId },
    { returnDocument: 'after' },
  );
  ticketId = doc!._id.toString();
});

describe('ticket detail (REQ-013)', () => {
  it('returns the ticket with its timeline in chronological order', async () => {
    await changeTicketStatus(ticketId, agentA, { status: 'pending' });
    await addReply(ticketId, agentA, { body: 'Looking into it now.' });

    const detail = await getTicketDetail(ticketId, agentA);

    expect(detail.events.map((e) => e.type)).toEqual(['created', 'status_changed', 'replied']);
    const times = detail.events.map((e) => new Date(e.createdAt).getTime());
    expect([...times].sort((x, y) => x - y)).toEqual(times);
  });

  it('resolves the assignee name', async () => {
    const detail = await getTicketDetail(ticketId, agentA);
    expect(detail.assignee).toMatchObject({ id: agentAId.toString(), name: 'Agent A' });
  });

  it('denies an agent access to another agent’s ticket', async () => {
    const error = await rejection(getTicketDetail(ticketId, agentB));
    expect(error.code).toBe('NOT_FOUND');
  });

  it('lets an admin open any ticket', async () => {
    await expect(getTicketDetail(ticketId, admin)).resolves.toMatchObject({ subject: CUSTOMER.subject });
  });
});

describe('replies (REQ-014, REQ-016)', () => {
  it('appends exactly one replied event', async () => {
    await addReply(ticketId, agentA, { body: 'We have reset it for you.' });

    const events = await TicketEvent.find({ type: 'replied' });
    expect(events).toHaveLength(1);
    expect(events[0]!.actor.name).toBe('Agent A');
    expect(events[0]!.payload.body).toBe('We have reset it for you.');
  });

  it('denormalises the reply onto the ticket for the public status check', async () => {
    await addReply(ticketId, agentA, { body: 'We have reset it for you.' });

    const status = await getPublicTicketStatus({
      ticketId: (await Ticket.findById(ticketId))!.ticketId,
      email: CUSTOMER.customerEmail,
    });

    expect(status.latestReply).toMatchObject({
      body: 'We have reset it for you.',
      authorName: 'Agent A',
    });
  });

  it('keeps only the most recent reply denormalised', async () => {
    await addReply(ticketId, agentA, { body: 'First response.' });
    await addReply(ticketId, agentA, { body: 'Second response.' });

    const ticket = await Ticket.findById(ticketId);
    expect(ticket!.lastAgentReply?.body).toBe('Second response.');
    expect(await TicketEvent.countDocuments({ type: 'replied' })).toBe(2);
  });

  it('rolls back the event when the denormalised write fails', async () => {
    const spy = vi
      .spyOn(Ticket, 'updateOne')
      .mockRejectedValueOnce(new Error('simulated denormalisation failure'));

    await expect(addReply(ticketId, agentA, { body: 'Should not persist.' })).rejects.toThrow(
      'simulated denormalisation failure',
    );

    expect(await TicketEvent.countDocuments({ type: 'replied' })).toBe(0);
    expect((await Ticket.findById(ticketId))!.lastAgentReply).toBeNull();
    spy.mockRestore();
  });

  it('refuses a reply to another agent’s ticket', async () => {
    const error = await rejection(addReply(ticketId, agentB, { body: 'Not mine.' }));
    expect(error.code).toBe('NOT_FOUND');
    expect(await TicketEvent.countDocuments({ type: 'replied' })).toBe(0);
  });
});

describe('status changes (REQ-015, REQ-016)', () => {
  it('updates the ticket and records from/to', async () => {
    await changeTicketStatus(ticketId, agentA, { status: 'resolved' });

    expect((await Ticket.findById(ticketId))!.status).toBe('resolved');
    const event = await TicketEvent.findOne({ type: 'status_changed' });
    expect(event!.payload).toMatchObject({ from: 'open', to: 'resolved' });
  });

  it('rejects a no-op change rather than writing a meaningless event', async () => {
    const error = await rejection(changeTicketStatus(ticketId, agentA, { status: 'open' }));
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(await TicketEvent.countDocuments({ type: 'status_changed' })).toBe(0);
  });

  it('refuses a status change on another agent’s ticket', async () => {
    const error = await rejection(changeTicketStatus(ticketId, agentB, { status: 'closed' }));
    expect(error.code).toBe('NOT_FOUND');
    expect((await Ticket.findById(ticketId))!.status).toBe('open');
  });
});

describe('reassignment (REQ-017)', () => {
  it('lets an admin reassign and records both names', async () => {
    await reassignTicket(ticketId, admin, { assigneeId: agentBId.toString() });

    expect((await Ticket.findById(ticketId))!.assigneeId?.toString()).toBe(agentBId.toString());
    const event = await TicketEvent.findOne({ type: 'reassigned' });
    expect(event!.payload).toMatchObject({ from: 'Agent A', to: 'Agent B' });
  });

  it('forbids an agent from reassigning, even their own ticket', async () => {
    const error = await rejection(reassignTicket(ticketId, agentA, { assigneeId: agentBId.toString() }));

    expect(error.code).toBe('FORBIDDEN');
    expect((await Ticket.findById(ticketId))!.assigneeId?.toString()).toBe(agentAId.toString());
  });

  it('transfers visibility along with the assignment', async () => {
    await reassignTicket(ticketId, admin, { assigneeId: agentBId.toString() });

    await expect(getTicketDetail(ticketId, agentB)).resolves.toBeTruthy();
    const error = await rejection(getTicketDetail(ticketId, agentA));
    expect(error.code).toBe('NOT_FOUND');
  });

  it('supports unassigning', async () => {
    await reassignTicket(ticketId, admin, { assigneeId: 'unassigned' });

    expect((await Ticket.findById(ticketId))!.assigneeId).toBeNull();
    expect((await TicketEvent.findOne({ type: 'reassigned' }))!.payload).toMatchObject({
      to: 'Unassigned',
    });
  });

  it('rejects an assignee that does not exist', async () => {
    const error = await rejection(
      reassignTicket(ticketId, admin, { assigneeId: new Types.ObjectId().toString() }),
    );
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a no-op reassignment', async () => {
    const error = await rejection(reassignTicket(ticketId, admin, { assigneeId: agentAId.toString() }));
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});

describe('timeline integrity', () => {
  it('appends exactly one event per successful mutation', async () => {
    await changeTicketStatus(ticketId, agentA, { status: 'pending' });
    await addReply(ticketId, agentA, { body: 'Working on it.' });
    await reassignTicket(ticketId, admin, { assigneeId: agentBId.toString() });

    const detail = await getTicketDetail(ticketId, admin);
    expect(detail.events.map((e) => e.type)).toEqual([
      'created',
      'status_changed',
      'replied',
      'reassigned',
    ]);
  });
});
