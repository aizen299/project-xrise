import { afterEach, describe, expect, it } from 'vitest';
import { isLocal } from '../../src/server/runtime-mode';

const original = process.env.NODE_ENV;

function setMode(value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env.NODE_ENV;
  else env.NODE_ENV = value;
}

afterEach(() => setMode(original));

describe('security flags fail closed', () => {
  it('treats an unknown environment as remote, so cookies stay Secure', () => {
    for (const value of ['', '   ', 'production', 'staging', undefined]) {
      setMode(value);
      expect(isLocal(), `NODE_ENV=${JSON.stringify(value)}`).toBe(false);
    }
  });

  it('only relaxes for genuine local development and test runs', () => {
    for (const value of ['development', 'test']) {
      setMode(value);
      expect(isLocal(), `NODE_ENV=${value}`).toBe(true);
    }
  });
});
