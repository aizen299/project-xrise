/**
 * Importing this module registers every schema with Mongoose. Scripts that
 * need all models present (seeding, index sync) should import from here.
 */
export { User, type UserDoc } from './user.model';
export { Ticket, type TicketDoc, type LastAgentReply } from './ticket.model';
export { TicketEvent, type TicketEventDoc, type TicketEventActor } from './ticket-event.model';
export { RateLimit, type RateLimitDoc } from './rate-limit.model';
