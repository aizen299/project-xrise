import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { connectToDatabase, disconnectFromDatabase } from '../../src/server/db/client';
import { RateLimit, Ticket, TicketEvent, User } from '../../src/server/db/models';

let mongod: MongoMemoryReplSet | null = null;


export async function startTestDb(): Promise<void> {
  mongod = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: 'wiredTiger' },
  });

  await connectToDatabase(mongod.getUri());

  await Promise.all([User, Ticket, TicketEvent, RateLimit].map((m) => m.syncIndexes()));
}

export async function stopTestDb(): Promise<void> {
  await disconnectFromDatabase();
  await mongod?.stop();
  mongod = null;
}


export async function clearTestDb(): Promise<void> {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}
