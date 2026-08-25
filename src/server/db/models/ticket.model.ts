import { Schema, model, models, type Model, type Types } from 'mongoose';
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from '../../../types';

export interface LastAgentReply {
  body: string;
  authorName: string;
  createdAt: Date;
}

export interface TicketDoc {
  _id: Types.ObjectId;
  ticketId: string;
  customerName: string;
  customerEmail: string;
  subject: string;
  body: string;
  priority: TicketPriority;
  status: TicketStatus;
  assigneeId: Types.ObjectId | null;
  lastAgentReply: LastAgentReply | null;
  createdAt: Date;
  updatedAt: Date;
}

const lastAgentReplySchema = new Schema<LastAgentReply>(
  {
    body: { type: String, required: true },
    authorName: { type: String, required: true },
    createdAt: { type: Date, required: true },
  },
  { _id: false },
);

const ticketSchema = new Schema<TicketDoc>(
  {
    ticketId: { type: String, required: true, unique: true },
    customerName: { type: String, required: true, trim: true, maxlength: 120 },
    customerEmail: { type: String, required: true, lowercase: true, trim: true },
    subject: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, maxlength: 5000 },
    priority: { type: String, required: true, enum: TICKET_PRIORITIES, default: 'medium' },
    status: { type: String, required: true, enum: TICKET_STATUSES, default: 'open' },
    assigneeId: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    /**
     * Denormalised copy of the most recent agent reply.
     *
     * The timeline lives in its own collection, so the public status check
     * would otherwise need a second query to answer "latest agent reply" — on
     * the only unauthenticated, rate-limit-exposed endpoint in the app. This
     * field is written in the same transaction as the `replied` event, trading
     * a small drift risk for a single indexed read on the hottest public path.
     */
    lastAgentReply: { type: lastAgentReplySchema, default: null },
  },
  { timestamps: true },
);

/*
 * Indexes exist to serve specific queries the app actually runs (REQ-031).
 * Compound keys follow Equality → Sort → Range ordering.
 */

// Agent dashboard: scoped to assignee, filtered by status/priority, newest first.
ticketSchema.index({ assigneeId: 1, status: 1, priority: 1, createdAt: -1 });

// Admin dashboard: same filters without the assignee prefix.
ticketSchema.index({ status: 1, priority: 1, createdAt: -1 });

// Unfiltered admin list — a compound index cannot serve a bare sort on
// createdAt because the sort key is not a prefix.
ticketSchema.index({ createdAt: -1 });

// Server-side search on subject / body (REQ-012). MongoDB permits only one
// text index per collection, so both fields live in this one; subject is
// weighted higher because a match there is a stronger signal.
ticketSchema.index(
  { subject: 'text', body: 'text' },
  { weights: { subject: 3, body: 1 }, name: 'ticket_search' },
);

export const Ticket: Model<TicketDoc> =
  (models.Ticket as Model<TicketDoc>) ?? model<TicketDoc>('Ticket', ticketSchema);
