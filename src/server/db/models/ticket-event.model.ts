import { Schema, model, models, type Model, type Types } from 'mongoose';
import {
  ACTOR_KINDS,
  TICKET_EVENT_TYPES,
  type ActorKind,
  type TicketEventType,
} from '../../../types';

export interface TicketEventActor {
  id: Types.ObjectId | null;
  name: string;
  kind: ActorKind;
}

export interface TicketEventDoc {
  _id: Types.ObjectId;
  ticketId: Types.ObjectId;
  type: TicketEventType;
  actor: TicketEventActor;
  /** `{ body }` for replies; `{ from, to }` for status and assignee changes. */
  payload: Record<string, unknown>;
  createdAt: Date;
}

const ticketEventSchema = new Schema<TicketEventDoc>(
  {
    ticketId: { type: Schema.Types.ObjectId, ref: 'Ticket', required: true },
    type: { type: String, required: true, enum: TICKET_EVENT_TYPES },
    actor: {
      id: { type: Schema.Types.ObjectId, ref: 'User', default: null },
      name: { type: String, required: true },
      kind: { type: String, required: true, enum: ACTOR_KINDS },
    },
    payload: { type: Schema.Types.Mixed, default: {} },
  },
  // Append-only: events are never edited, so updatedAt would be dead weight.
  { timestamps: { createdAt: true, updatedAt: false } },
);

// The only query this collection serves: one ticket's timeline, oldest first.
ticketEventSchema.index({ ticketId: 1, createdAt: 1 });

export const TicketEvent: Model<TicketEventDoc> =
  (models.TicketEvent as Model<TicketEventDoc>) ??
  model<TicketEventDoc>('TicketEvent', ticketEventSchema);
