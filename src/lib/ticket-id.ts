import { customAlphabet } from 'nanoid';

/**
 * Crockford-style alphabet: no 0/O (round), no 1/I/L (vertical stroke),
 * because customers read this ID off a screen and retype it into the
 * status-check form. 31 symbols x 10 positions ~= 8.2e14 combinations, which
 * is far too sparse to enumerate against an unauthenticated endpoint.
 */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const ID_LENGTH = 10;

const nano = customAlphabet(ALPHABET, ID_LENGTH);

/**
 * Public ticket identifier, e.g. `XR-7K2MHQ4PDA`.
 *
 * Deliberately random rather than sequential: the status-check endpoint is
 * unauthenticated, so a guessable ID would let anyone enumerate tickets given
 * a customer email.
 */
export function generateTicketId(): string {
  return `XR-${nano()}`;
}

/** Shape check only — does not assert the ticket exists. */
export function isTicketIdShape(value: string): boolean {
  return new RegExp(`^XR-[${ALPHABET}]{${ID_LENGTH}}$`).test(value.trim().toUpperCase());
}
