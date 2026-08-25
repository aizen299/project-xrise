import { customAlphabet } from 'nanoid';


const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const ID_LENGTH = 10;

const nano = customAlphabet(ALPHABET, ID_LENGTH);


export function generateTicketId(): string {
  return `XR-${nano()}`;
}

/** Shape check only — does not assert the ticket exists. */
export function isTicketIdShape(value: string): boolean {
  return new RegExp(`^XR-[${ALPHABET}]{${ID_LENGTH}}$`).test(value.trim().toUpperCase());
}
