import mongoose, { type ClientSession } from 'mongoose';

/**
 * Runs `fn` inside a multi-document transaction.
 *
 * Requires a replica set. MongoDB Atlas always is one; a bare standalone
 * `mongod` is not, which is why the README insists on Atlas and why
 * `npm run db:check` reports the replica set name.
 */
export async function withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(fn);
  } finally {
    await session.endSession();
  }
}
