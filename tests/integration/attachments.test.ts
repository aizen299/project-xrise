import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { clearTestDb, startTestDb, stopTestDb } from '../helpers/db';
import { rejection } from '../helpers/rejection';
import { Ticket } from '../../src/server/db/models';
import { createTicket, getPublicTicketStatus } from '../../src/server/services/ticket.service';
import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENTS_PER_TICKET,
  assertUploadable,
  listAttachments,
  sanitizeFilename,
} from '../../src/server/db/attachments';

const TICKET = {
  customerName: 'Priya Raman',
  customerEmail: 'priya@example.com',
  subject: 'Screenshot of the broken layout',
  body: 'The sidebar overlaps the content, screenshot attached for reference.',
  priority: 'medium' as const,
};

function file(name: string, type: string, bytes = 64) {
  return { name, type, size: bytes, buffer: Buffer.alloc(bytes, 1) };
}

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

describe('filename sanitisation', () => {
  it('strips directory traversal', () => {
    expect(sanitizeFilename('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFilename('..\\..\\windows\\system32')).toBe('system32');
  });

  it('never returns a dotfile or an empty name', () => {
    expect(sanitizeFilename('...')).toBe('file');
    expect(sanitizeFilename('')).toBe('file');
    expect(sanitizeFilename('.env')).toBe('env');
  });

  it('removes characters that could confuse a Content-Disposition header', () => {
    expect(sanitizeFilename('re"port;.png')).toBe('re_port_.png');
  });

  it('caps absurdly long names', () => {
    expect(sanitizeFilename(`${'a'.repeat(500)}.png`).length).toBeLessThanOrEqual(120);
  });
});

describe('upload validation', () => {
  it('accepts the documented types', () => {
    for (const type of ['image/png', 'image/jpeg', 'application/pdf', 'text/csv']) {
      expect(() => assertUploadable(file('ok', type))).not.toThrow();
    }
  });

  it('rejects executable and markup types that could run in a browser', () => {
    for (const type of ['text/html', 'image/svg+xml', 'application/javascript', 'application/x-sh']) {
      expect(() => assertUploadable(file('bad', type))).toThrowError(
        expect.objectContaining({ code: 'VALIDATION_ERROR' }),
      );
    }
  });

  it('rejects a file over the size cap', () => {
    expect(() => assertUploadable(file('big.png', 'image/png', MAX_ATTACHMENT_BYTES + 1))).toThrow();
  });

  it('rejects an empty file', () => {
    expect(() => assertUploadable(file('empty.png', 'image/png', 0))).toThrow();
  });
});

describe('attachments on ticket creation', () => {
  it('stores files against the ticket', async () => {
    const { ticketId } = await createTicket(TICKET, [
      file('screenshot.png', 'image/png', 128),
      file('log.txt', 'text/plain', 32),
    ]);

    const ticket = await Ticket.findOne({ ticketId });
    const stored = await listAttachments(ticket!._id);

    expect(stored).toHaveLength(2);
    expect(stored.map((a) => a.filename).sort()).toEqual(['log.txt', 'screenshot.png']);
    expect(stored.find((a) => a.filename === 'screenshot.png')?.contentType).toBe('image/png');
  });

  it('creates a ticket with no attachments when none are sent', async () => {
    const { ticketId } = await createTicket(TICKET);
    const ticket = await Ticket.findOne({ ticketId });
    expect(await listAttachments(ticket!._id)).toHaveLength(0);
  });

  it('refuses more than the documented maximum', async () => {
    const many = Array.from({ length: MAX_ATTACHMENTS_PER_TICKET + 1 }, (_, i) =>
      file(`f${i}.png`, 'image/png'),
    );
    const error = await rejection(createTicket(TICKET, many));
    expect(error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects the whole submission before creating a ticket if a file is invalid', async () => {
    // Validation happens up front, so a bad attachment never leaves a
    // half-created ticket behind.
    await rejection(createTicket(TICKET, [file('virus.sh', 'application/x-sh')]));
    expect(await Ticket.countDocuments({})).toBe(0);
  });

  it('exposes attachments on the public status check', async () => {
    const { ticketId } = await createTicket(TICKET, [file('screenshot.png', 'image/png', 90)]);
    const status = await getPublicTicketStatus({ ticketId, email: TICKET.customerEmail });

    expect(status.attachments).toHaveLength(1);
    expect(status.attachments[0]).toMatchObject({ filename: 'screenshot.png', size: 90 });
  });
});
