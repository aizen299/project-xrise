import { z } from 'zod';

/**
 * Environment contract. Parsed lazily rather than at module load so that
 * importing a model or a service does not explode during `next build`, where
 * runtime secrets are legitimately absent.
 */
const envSchema = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters (openssl rand -base64 48)'),
  APP_ORIGIN: z.url('APP_ORIGIN must be an absolute URL').default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration:\n${problems}\n\n` +
        'Copy .env.example to .env and fill in the values.',
    );
  }

  cached = parsed.data;
  return cached;
}

/** Test-only escape hatch so suites can re-read a mutated process.env. */
export function resetEnvCache(): void {
  cached = null;
}
