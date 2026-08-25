
(process.env as Record<string, string | undefined>).NODE_ENV = 'test';
process.env.JWT_SECRET ??= 'test-only-secret-at-least-thirty-two-characters-long';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/xrise-test';
process.env.APP_ORIGIN ??= 'http://localhost:3000';
process.env.LOG_LEVEL = 'silent';
