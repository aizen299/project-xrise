import 'dotenv/config';
import { connectToDatabase, disconnectFromDatabase } from '../src/server/db/client';
import { RateLimit, Ticket, TicketEvent, User } from '../src/server/db/models';


async function syncIndexes(): Promise<void> {
  await connectToDatabase();

  for (const model of [User, Ticket, TicketEvent, RateLimit]) {
    await model.syncIndexes();
    const indexes = await model.collection.indexes();
    console.log(`\n${model.modelName}:`);
    for (const index of indexes) {
      console.log(`  ${index.name}  ${JSON.stringify(index.key)}`);
    }
  }

  await disconnectFromDatabase();
}

syncIndexes().catch(async (error: unknown) => {
  console.error('Index sync failed:', error);
  await disconnectFromDatabase();
  process.exit(1);
});
