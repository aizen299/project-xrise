import mongoose from 'mongoose';
import { getEnv } from '../env';
import { logger } from '../logger';
import { redactErrorMessage } from '../redact';

/**
 * Serverless-safe connection cache. Each lambda invocation may reuse a warm
 * container, so the connection (and the in-flight promise) are stashed on the
 * global object to survive module re-evaluation and avoid opening a new pool
 * per request.
 */
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var __xriseMongoose: MongooseCache | undefined;
}

const cache: MongooseCache = globalThis.__xriseMongoose ?? { conn: null, promise: null };
globalThis.__xriseMongoose = cache;

export async function connectToDatabase(
  uri?: string,
  overrides?: mongoose.ConnectOptions,
): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    const connectionString = uri ?? getEnv().MONGODB_URI;

    // Reject query operators that were never declared in the schema, which is
    // one of the layers stopping `{ "$ne": null }` style injection.
    mongoose.set('strictQuery', true);

    cache.promise = mongoose
      .connect(connectionString, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10_000,
        // Index builds are a deploy-time concern, not a request-time one.
        // Production indexes are applied by `npm run db:indexes`.
        autoIndex: process.env.NODE_ENV !== 'production',
        ...overrides,
      })
      .then((m) => {
        logger.info({ event: 'db.connected' }, 'MongoDB connected');
        return m;
      })
      .catch((error: unknown) => {
        cache.promise = null; // let the next request retry
        logger.error(
          { event: 'db.connect_failed', reason: redactErrorMessage(error) },
          'MongoDB connection failed',
        );
        throw error;
      });
  }

  cache.conn = await cache.promise;
  return cache.conn;
}

export async function disconnectFromDatabase(): Promise<void> {
  if (cache.conn) {
    await cache.conn.disconnect();
  }
  cache.conn = null;
  cache.promise = null;
}
