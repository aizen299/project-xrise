/**
 * Test-time environment. getEnv() validates the whole contract, so these must
 * exist before any module that reads it is imported. The Mongo URI is a
 * placeholder — the in-memory server's real URI is passed to
 * connectToDatabase() explicitly by the test harness.
 */
// NODE_ENV is typed readonly by @types/node; tests legitimately need to set it.
(process.env as Record<string, string | undefined>).NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-only-secret-at-least-thirty-two-characters-long';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/xrise-test';
process.env.APP_ORIGIN ??= 'http://localhost:3000';
process.env.LOG_LEVEL = 'silent';
