import 'dotenv/config';
import { connectToDatabase, disconnectFromDatabase } from '../src/server/db/client';
import { Ticket, TicketEvent, User } from '../src/server/db/models';

const EVENT_LABEL: Record<string, string> = {
  created: 'created',
  replied: 'replied',
  status_changed: 'status changed',
  reassigned: 'reassigned',
};

async function showTicket(ticketId: string): Promise<void> {
  const ticket = await Ticket.findOne({ ticketId: ticketId.toUpperCase() }).lean();
  if (!ticket) {
    console.log(`\nNo ticket with id ${ticketId}\n`);
    return;
  }

  const assignee = ticket.assigneeId
    ? await User.findById(ticket.assigneeId, { name: 1 }).lean<{ name: string }>()
    : null;

  console.log(`\n${ticket.ticketId}  ${ticket.subject}`);
  console.log(`  from      ${ticket.customerName} <${ticket.customerEmail}>`);
  console.log(`  status    ${ticket.status}   priority ${ticket.priority}`);
  console.log(`  assignee  ${assignee?.name ?? 'Unassigned'}`);
  console.log(`  created   ${new Date(ticket.createdAt).toLocaleString()}`);
  console.log(`\n  body: ${ticket.body}`);

  const events = await TicketEvent.find({ ticketId: ticket._id }).sort({ createdAt: 1 }).lean();
  console.log(`\n  timeline (${events.length} events):`);
  for (const event of events) {
    const when = new Date(event.createdAt).toLocaleString();
    const label = EVENT_LABEL[event.type] ?? event.type;
    const detail =
      event.type === 'replied'
        ? `: ${String((event.payload as { body?: string }).body ?? '').slice(0, 60)}`
        : event.type === 'created'
          ? ''
          : `: ${String((event.payload as { from?: string }).from ?? '')} -> ${String((event.payload as { to?: string }).to ?? '')}`;
    console.log(`    ${when}  ${event.actor.name} ${label}${detail}`);
  }
  console.log('');
}

async function showOverview(): Promise<void> {
  const [tickets, events, users] = await Promise.all([
    Ticket.countDocuments({}),
    TicketEvent.countDocuments({}),
    User.find({}, { email: 1, name: 1, role: 1 }).lean(),
  ]);

  console.log(`\n${tickets} tickets, ${events} timeline events\n`);
  console.log('  accounts');
  for (const user of users) {
    const owned =
      user.role === 'admin' ? tickets : await Ticket.countDocuments({ assigneeId: user._id });
    console.log(`    ${user.email.padEnd(24)} ${user.role.padEnd(6)} sees ${owned}`);
  }
  console.log(`    ${'(unassigned)'.padEnd(24)} ${''.padEnd(6)} ${await Ticket.countDocuments({ assigneeId: null })}`);

  const recent = await Ticket.find({}, { ticketId: 1, subject: 1, status: 1, customerEmail: 1, createdAt: 1 })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();

  console.log('\n  10 most recent tickets');
  for (const ticket of recent) {
    console.log(
      `    ${ticket.ticketId}  ${ticket.status.padEnd(8)} ${String(ticket.subject).slice(0, 32).padEnd(32)} ${ticket.customerEmail}`,
    );
  }
  console.log('\n  Pass a ticket id to see its full timeline:');
  console.log('    npm run db:inspect -- XR-XXXXXXXXXX\n');
}

async function main(): Promise<void> {
  await connectToDatabase();
  const target = process.argv[2];
  if (target) await showTicket(target);
  else await showOverview();
  await disconnectFromDatabase();
}

main().catch(async (error: unknown) => {
  console.error('Inspect failed:', error instanceof Error ? error.message : error);
  await disconnectFromDatabase();
  process.exit(1);
});
