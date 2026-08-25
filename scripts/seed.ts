import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { connectToDatabase, disconnectFromDatabase } from '../src/server/db/client';
import { Ticket, TicketEvent, User } from '../src/server/db/models';
import { hashPassword } from '../src/server/auth/password';
import { generateTicketId } from '../src/lib/ticket-id';
import type { TicketPriority, TicketStatus } from '../src/types';

/**
 * Seeds the two agents the assignment names (REQ-005) plus a spread of tickets
 * so that filtering, pagination, search and — most importantly — the
 * agent-vs-admin scoping split are demonstrable immediately.
 */

const AGENT_PASSWORD = process.env.SEED_AGENT_PASSWORD ?? 'Password123!';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Password123!';

const SAMPLE_TICKETS: Array<{
  customerName: string;
  customerEmail: string;
  subject: string;
  body: string;
  priority: TicketPriority;
  status: TicketStatus;
  assign: 'agent1' | 'agent2' | null;
}> = [
  { customerName: 'Priya Raman', customerEmail: 'priya@example.com', subject: 'Cannot reset my password', body: 'The reset link in the email returns "token expired" every time I click it, even immediately after requesting a new one.', priority: 'high', status: 'open', assign: 'agent1' },
  { customerName: 'Tom Whitfield', customerEmail: 'tom@example.com', subject: 'Billing charged twice this month', body: 'I was charged on the 3rd and again on the 5th for the same subscription. Please refund the duplicate.', priority: 'urgent', status: 'open', assign: 'agent1' },
  { customerName: 'Aisha Bello', customerEmail: 'aisha@example.com', subject: 'Export to CSV is missing columns', body: 'The CSV export drops the "created date" and "owner" columns that are visible in the table view.', priority: 'medium', status: 'pending', assign: 'agent1' },
  { customerName: 'Marco Silva', customerEmail: 'marco@example.com', subject: 'Mobile layout breaks on iPhone SE', body: 'The dashboard sidebar overlaps the content area on smaller phones and cannot be dismissed.', priority: 'low', status: 'resolved', assign: 'agent1' },
  { customerName: 'Hannah Cole', customerEmail: 'hannah@example.com', subject: 'API returns 500 on bulk upload', body: 'Uploading more than 200 rows at once consistently fails with an internal server error.', priority: 'urgent', status: 'open', assign: 'agent2' },
  { customerName: 'Dmitri Volkov', customerEmail: 'dmitri@example.com', subject: 'Two-factor codes rejected', body: 'Authenticator codes are rejected as invalid although the device clock is correct.', priority: 'high', status: 'pending', assign: 'agent2' },
  { customerName: 'Lena Fischer', customerEmail: 'lena@example.com', subject: 'Request: dark mode', body: 'Would love a dark theme for the agent console. Working late is rough on the eyes.', priority: 'low', status: 'open', assign: 'agent2' },
  { customerName: 'Sam Okafor', customerEmail: 'sam@example.com', subject: 'Webhook deliveries stopped', body: 'No webhook events have arrived since Tuesday. The endpoint responds 200 to manual tests.', priority: 'high', status: 'closed', assign: 'agent2' },
  { customerName: 'Elena Rossi', customerEmail: 'elena@example.com', subject: 'Invoice PDF is blank', body: 'Downloaded invoices open as a blank single page in both Preview and Acrobat.', priority: 'medium', status: 'open', assign: null },
  { customerName: 'Yusuf Karim', customerEmail: 'yusuf@example.com', subject: 'Cannot invite teammates', body: 'The invite button is greyed out even though our plan allows five seats and we are using two.', priority: 'medium', status: 'open', assign: null },
  { customerName: 'Grace Lin', customerEmail: 'grace@example.com', subject: 'Search returns no results', body: 'Searching for tickets by subject returns nothing even for terms I can see on screen.', priority: 'high', status: 'open', assign: null },
  { customerName: 'Oliver Bennett', customerEmail: 'oliver@example.com', subject: 'Timezone shown incorrectly', body: 'All timestamps display in UTC despite my profile being set to Europe/London.', priority: 'low', status: 'pending', assign: null },
];

export interface SeedSummary {
  agent1: number;
  agent2: number;
  unassigned: number;
  total: number;
}


export async function seed(): Promise<SeedSummary> {
  await connectToDatabase();

  await Promise.all([
    User.deleteMany({}),
    Ticket.deleteMany({}),
    TicketEvent.deleteMany({}),
  ]);

  const [agent1, agent2] = await User.create([
    { email: 'agent1@xriseai.com', name: 'Agent One', role: 'agent', passwordHash: await hashPassword(AGENT_PASSWORD) },
    { email: 'agent2@xriseai.com', name: 'Agent Two', role: 'agent', passwordHash: await hashPassword(AGENT_PASSWORD) },
    { email: 'admin@xriseai.com', name: 'Admin User', role: 'admin', passwordHash: await hashPassword(ADMIN_PASSWORD) },
  ]);

  const assigneeFor = { agent1: agent1._id, agent2: agent2._id };

  for (const sample of SAMPLE_TICKETS) {
    const ticket = await Ticket.create({
      ticketId: generateTicketId(),
      customerName: sample.customerName,
      customerEmail: sample.customerEmail,
      subject: sample.subject,
      body: sample.body,
      priority: sample.priority,
      status: sample.status,
      assigneeId: sample.assign ? assigneeFor[sample.assign] : null,
    });

    await TicketEvent.create({
      ticketId: ticket._id,
      type: 'created',
      actor: { id: null, name: sample.customerName, kind: 'customer' },
      payload: { priority: sample.priority },
    });
  }

  return {
    agent1: await Ticket.countDocuments({ assigneeId: agent1._id }),
    agent2: await Ticket.countDocuments({ assigneeId: agent2._id }),
    unassigned: await Ticket.countDocuments({ assigneeId: null }),
    total: await Ticket.countDocuments({}),
  };
}

const isDirectRun =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  seed()
    .then(async (counts) => {
      console.log('\nSeed complete.\n');
      console.table([
        { account: 'agent1@xriseai.com', role: 'agent', password: AGENT_PASSWORD, sees: counts.agent1 },
        { account: 'agent2@xriseai.com', role: 'agent', password: AGENT_PASSWORD, sees: counts.agent2 },
        { account: 'admin@xriseai.com', role: 'admin', password: ADMIN_PASSWORD, sees: counts.total },
      ]);
      console.log(`Tickets: ${counts.total} total, ${counts.unassigned} unassigned.`);
      console.log('An agent must never see the other agent\u2019s tickets \u2014 that is the core scoping rule.\n');
      await disconnectFromDatabase();
    })
    .catch(async (error: unknown) => {
      console.error('Seed failed:', error);
      await disconnectFromDatabase();
      process.exit(1);
    });
}
