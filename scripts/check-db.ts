import 'dotenv/config';
import mongoose from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '../src/server/db/client';
import { redactErrorMessage } from '../src/server/redact';

/**
 * Verifies the Atlas connection string before you waste time debugging a
 * seed or a page load. Reports whether the deployment is a replica set,
 * because multi-document transactions require one — Atlas always is, a bare
 * local `mongod` is not.
 */
async function check(): Promise<void> {
  const startedAt = Date.now();
  await connectToDatabase();
  const elapsed = Date.now() - startedAt;

  const db = mongoose.connection.db;
  if (!db) throw new Error('Connected but no database handle was returned.');

  const hello = (await db.admin().command({ hello: 1 })) as {
    me?: string;
    setName?: string;
maxWireVersion?: number;
  };

  console.log(`\nConnected in ${elapsed}ms`);
  console.log(`  database:    ${db.databaseName}`);
  console.log(`  host:        ${hello.me ?? 'unknown'}`);
  console.log(`  replica set: ${hello.setName ?? 'none — transactions will NOT work'}`);

  const collections = await db.listCollections().toArray();
  console.log(`  collections: ${collections.length === 0 ? '(empty — run npm run db:seed)' : collections.map((c) => c.name).join(', ')}\n`);

  await disconnectFromDatabase();
}

check().catch(async (error: unknown) => {
  // Redacted: driver errors often quote the URI, password included.
  console.error('\nConnection failed:', redactErrorMessage(error));
  console.error('\nCheck that MONGODB_URI is set, the password is URL-encoded, and');
  console.error('that your Atlas cluster allows access from this IP address.\n');
  await disconnectFromDatabase();
  process.exit(1);
});
