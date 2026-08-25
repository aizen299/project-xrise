import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { connectToDatabase, disconnectFromDatabase } from '../../src/server/db/client';
import { RateLimit, Ticket, TicketEvent, User } from '../../src/server/db/models';

let mongod: MongoMemoryServer | null = null;

/** Boots an in-memory MongoDB and points the app's connection cache at it. */
export async function startTestDb(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  await connectToDatabase(mongod.getUri());
  // Build declared indexes so tests exercise the same access paths production
  // will, including the unique constraints.
  await Promise.all([User, Ticket, TicketEvent, RateLimit].map((m) => m.syncIndexes()));
}

export async function stopTestDb(): Promise<void> {
  await disconnectFromDatabase();
  await mongod?.stop();
  mongod = null;
}

/** Wipes documents between tests without tearing down indexes. */
export async function clearTestDb(): Promise<void> {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}
