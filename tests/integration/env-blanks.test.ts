import { afterEach, describe, expect, it } from 'vitest';
import { getEnv, resetEnvCache } from '../../src/server/env';
import { aiConfig } from '../../src/server/ai/provider';

const BLANKABLE = ['LOG_LEVEL', 'LLM_MODEL', 'LLM_BASE_URL', 'LLM_API_KEY', 'APP_ORIGIN'];

function restore() {
  for (const key of BLANKABLE) delete process.env[key];
  resetEnvCache();
}

afterEach(restore);

describe('blank environment variables', () => {
  it('treats a blank optional variable as unset rather than crashing', () => {
    for (const key of BLANKABLE) process.env[key] = '';
    resetEnvCache();

    expect(() => getEnv()).not.toThrow();
  });

  it('falls back to defaults when variables are blank', () => {
    process.env.LOG_LEVEL = '';
    process.env.APP_ORIGIN = '';
    resetEnvCache();

    const env = getEnv();
    expect(env.LOG_LEVEL).toBe('info');
    expect(env.APP_ORIGIN).toBe('http://localhost:3000');
  });

  it('does not let a blank model override the provider default', () => {
    process.env.LLM_MODEL = '';
    process.env.LLM_API_KEY = 'test-key';
    resetEnvCache();

    expect(aiConfig().model).toBe('openai/gpt-oss-120b');
  });

  it('treats a blank API key as the feature being disabled', () => {
    process.env.LLM_API_KEY = '   ';
    resetEnvCache();

    expect(aiConfig().enabled).toBe(false);
  });

  it('still rejects a genuinely invalid value', () => {
    process.env.APP_ORIGIN = 'not-a-url';
    resetEnvCache();

    expect(() => getEnv()).toThrowError(/APP_ORIGIN/);
  });
});
