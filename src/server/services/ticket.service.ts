import { Types, type SortOrder } from 'mongoose';
import { Ticket, TicketEvent, type TicketDoc } from '../db/models';
import { isAdmin, scopeTicketQuery, type AuthUser } from '../auth/guards';
import { notFound } from '../errors';
import { withTransaction } from '../db/transaction';
import { generateTicketId } from '../../lib/ticket-id';
import type {
  CreateTicketInput,
  ReassignInput,
  ReplyInput,
  StatusChangeInput,
  StatusLookupInput,
  TicketListQuery,
} from '../validation/schemas';
import { badRequest, forbidden } from '../errors';
import type { ActorKind, TicketEventType } from '../../types';
import { UNASSIGNED } from '../validation/schemas';
import { User } from '../db/models';
import type { TicketPriority, TicketStatus } from '../../types';



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


export async function getTicketForUser(id: string, user: AuthUser): Promise<TicketDoc> {
  if (!Types.ObjectId.isValid(id)) throw notFound('Ticket not found.');

  const ticket = await Ticket.findOne({
    _id: new Types.ObjectId(id),
    ...scopeTicketQuery(user),
  }).lean<TicketDoc>();

  if (!ticket) throw notFound('Ticket not found.');
  return ticket;
}




const MAX_TICKET_ID_ATTEMPTS = 3;


export async function createTicket(input: CreateTicketInput): Promise<{ ticketId: string }> {
  for (let attempt = 1; attempt <= MAX_TICKET_ID_ATTEMPTS; attempt += 1) {
    const ticketId = generateTicketId();

    try {
      await withTransaction(async (session) => {
        const [ticket] = await Ticket.create([{ ...input, ticketId }], { session });
        await TicketEvent.create(
          [
            {
              ticketId: ticket._id,
              type: 'created',
              actor: { id: null, name: input.customerName, kind: 'customer' },
              payload: { priority: input.priority },
            },
          ],
          { session },
        );
      });

      return { ticketId };
    } catch (error) {
      
      const isCollision =
        typeof error === 'object' &&
        error !== null &&
        (error as { code?: number }).code === 11000;

      if (!isCollision || attempt === MAX_TICKET_ID_ATTEMPTS) throw error;
    }
  }

  throw new Error('Could not allocate a unique ticket id.');
}

export interface PublicTicketStatus {
  ticketId: string;
  subject: string;
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: Date;
  latestReply: { body: string; authorName: string; createdAt: Date } | null;
}


export async function getPublicTicketStatus(
  input: StatusLookupInput,
): Promise<PublicTicketStatus> {
  const ticket = await Ticket.findOne(
    { ticketId: input.ticketId, customerEmail: input.email },
    { ticketId: 1, subject: 1, status: 1, priority: 1, createdAt: 1, lastAgentReply: 1 },
  ).lean<TicketDoc>();

  if (!ticket) {
    
    throw notFound('No ticket matches that ID and email address.');
  }

  return {
    ticketId: ticket.ticketId,
    subject: ticket.subject,
    status: ticket.status,
    priority: ticket.priority,
    createdAt: ticket.createdAt,
    latestReply: ticket.lastAgentReply
      ? {
          body: ticket.lastAgentReply.body,
          authorName: ticket.lastAgentReply.authorName,
          createdAt: ticket.lastAgentReply.createdAt,
        }
      : null,
  };
}


export interface TicketListRow {
  id: string;
  ticketId: string;
  subject: string;
  customerName: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TicketListPage {
  rows: TicketListRow[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function buildTicketFilter(query: TicketListQuery, user: AuthUser): Record<string, unknown> {
  const requested: Record<string, unknown> = {};

  if (query.status) requested.status = query.status;
  if (query.priority) requested.priority = query.priority;

  if (query.assigneeId === UNASSIGNED) {
    requested.assigneeId = null;
  } else if (query.assigneeId) {
    requested.assigneeId = new Types.ObjectId(query.assigneeId);
  }

  if (query.q) requested.$text = { $search: query.q };

  return { ...requested, ...scopeTicketQuery(user) };
}

export async function listTickets(
  user: AuthUser,
  query: TicketListQuery,
): Promise<TicketListPage> {
  const filter = buildTicketFilter(query, user);
  const searching = Boolean(query.q);

  const projection = searching
    ? { score: { $meta: 'textScore' } }
    : {};
  const sort: Record<string, SortOrder | { $meta: string }> = searching
    ? { score: { $meta: 'textScore' }, createdAt: -1 }
    : { createdAt: -1 };

  const [docs, total] = await Promise.all([
    Ticket.find(filter, projection)
      .sort(sort)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<TicketDoc[]>(),
    Ticket.countDocuments(filter),
  ]);

  const assigneeIds = [
    ...new Set(
      docs
        .map((doc) => doc.assigneeId?.toString())
        .filter((id): id is string => typeof id === 'string'),
    ),
  ];
  const agents = assigneeIds.length
    ? await User.find({ _id: { $in: assigneeIds } }, { name: 1 }).lean<{ _id: Types.ObjectId; name: string }[]>()
    : [];
  const agentNames = new Map(agents.map((a) => [a._id.toString(), a.name]));

  return {
    rows: docs.map((doc) => ({
      id: doc._id.toString(),
      ticketId: doc.ticketId,
      subject: doc.subject,
      customerName: doc.customerName,
      status: doc.status,
      priority: doc.priority,
      assignee: doc.assigneeId
        ? { id: doc.assigneeId.toString(), name: agentNames.get(doc.assigneeId.toString()) ?? 'Unknown' }
        : null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    })),
    total,
    page: query.page,
    limit: query.limit,
    totalPages: Math.max(1, Math.ceil(total / query.limit)),
  };
}

export async function explainTicketList(
  user: AuthUser,
  query: TicketListQuery,
): Promise<Record<string, unknown>> {
  const filter = buildTicketFilter(query, user);
  return Ticket.find(filter).sort({ createdAt: -1 }).limit(query.limit).explain('queryPlanner') as unknown as Record<string, unknown>;
}


export interface TimelineEvent {
  id: string;
  type: TicketEventType;
  actorName: string;
  actorKind: ActorKind;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface TicketDetail {
  id: string;
  ticketId: string;
  subject: string;
  body: string;
  customerName: string;
  customerEmail: string;
  status: TicketStatus;
  priority: TicketPriority;
  assignee: { id: string; name: string } | null;
  createdAt: Date;
  updatedAt: Date;
  events: TimelineEvent[];
}

function toTimelineEvent(doc: {
  _id: Types.ObjectId;
  type: TicketEventType;
  actor: { name: string; kind: ActorKind };
  payload?: Record<string, unknown>;
  createdAt: Date;
}): TimelineEvent {
  return {
    id: doc._id.toString(),
    type: doc.type,
    actorName: doc.actor.name,
    actorKind: doc.actor.kind,
    payload: doc.payload ?? {},
    createdAt: doc.createdAt,
  };
}

async function loadScopedTicket(id: string, user: AuthUser) {
  if (!Types.ObjectId.isValid(id)) throw notFound('Ticket not found.');

  const ticket = await Ticket.findOne({
    _id: new Types.ObjectId(id),
    ...scopeTicketQuery(user),
  }).lean<TicketDoc>();

  if (!ticket) throw notFound('Ticket not found.');
  return ticket;
}

async function resolveAgentName(id: Types.ObjectId | null): Promise<string | null> {
  if (!id) return null;
  const agent = await User.findById(id, { name: 1 }).lean<{ name: string }>();
  return agent?.name ?? 'Unknown';
}

export async function getTicketDetail(id: string, user: AuthUser): Promise<TicketDetail> {
  const ticket = await loadScopedTicket(id, user);

  const [events, assigneeName] = await Promise.all([
    TicketEvent.find({ ticketId: ticket._id })
      .sort({ createdAt: 1 })
      .lean<Parameters<typeof toTimelineEvent>[0][]>(),
    resolveAgentName(ticket.assigneeId),
  ]);

  return {
    id: ticket._id.toString(),
    ticketId: ticket.ticketId,
    subject: ticket.subject,
    body: ticket.body,
    customerName: ticket.customerName,
    customerEmail: ticket.customerEmail,
    status: ticket.status,
    priority: ticket.priority,
    assignee:
      ticket.assigneeId && assigneeName
        ? { id: ticket.assigneeId.toString(), name: assigneeName }
        : null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    events: events.map(toTimelineEvent),
  };
}

export async function addReply(
  id: string,
  user: AuthUser,
  input: ReplyInput,
): Promise<TimelineEvent> {
  const target = await loadScopedTicket(id, user);
  const createdAt = new Date();

  return withTransaction(async (session) => {
    const [event] = await TicketEvent.create(
      [
        {
          ticketId: target._id,
          type: 'replied',
          actor: { id: new Types.ObjectId(user.sub), name: user.name, kind: 'agent' },
          payload: { body: input.body },
          createdAt,
        },
      ],
      { session },
    );

    await Ticket.updateOne(
      { _id: target._id, ...scopeTicketQuery(user) },
      { lastAgentReply: { body: input.body, authorName: user.name, createdAt } },
      { session },
    );

    return toTimelineEvent(event);
  });
}

export async function changeTicketStatus(
  id: string,
  user: AuthUser,
  input: StatusChangeInput,
): Promise<TimelineEvent> {
  const target = await loadScopedTicket(id, user);

  if (target.status === input.status) {
    throw badRequest(`This ticket is already ${input.status}.`);
  }

  return withTransaction(async (session) => {
    const [event] = await TicketEvent.create(
      [
        {
          ticketId: target._id,
          type: 'status_changed',
          actor: { id: new Types.ObjectId(user.sub), name: user.name, kind: 'agent' },
          payload: { from: target.status, to: input.status },
        },
      ],
      { session },
    );

    await Ticket.updateOne(
      { _id: target._id, ...scopeTicketQuery(user) },
      { status: input.status },
      { session },
    );

    return toTimelineEvent(event);
  });
}

export async function reassignTicket(
  id: string,
  user: AuthUser,
  input: ReassignInput,
): Promise<TimelineEvent> {
  if (!isAdmin(user)) throw forbidden('Only an admin can reassign tickets.');

  const target = await loadScopedTicket(id, user);
  const nextAssigneeId =
    input.assigneeId === UNASSIGNED ? null : new Types.ObjectId(input.assigneeId);

  if (nextAssigneeId && !(await User.exists({ _id: nextAssigneeId }))) {
    throw badRequest('That agent does not exist.');
  }

  if (String(target.assigneeId ?? '') === String(nextAssigneeId ?? '')) {
    throw badRequest('This ticket is already assigned that way.');
  }

  const [fromName, toName] = await Promise.all([
    resolveAgentName(target.assigneeId),
    resolveAgentName(nextAssigneeId),
  ]);

  return withTransaction(async (session) => {
    const [event] = await TicketEvent.create(
      [
        {
          ticketId: target._id,
          type: 'reassigned',
          actor: { id: new Types.ObjectId(user.sub), name: user.name, kind: 'agent' },
          payload: { from: fromName ?? 'Unassigned', to: toName ?? 'Unassigned' },
        },
      ],
      { session },
    );

    await Ticket.updateOne({ _id: target._id }, { assigneeId: nextAssigneeId }, { session });

    return toTimelineEvent(event);
  });
}
