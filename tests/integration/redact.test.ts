import { describe, expect, it } from 'vitest';
import { redactErrorMessage, redactSecrets } from '../../src/server/redact';

/*
 * Fixtures are assembled from fragments at runtime rather than written as
 * literals.
 *
 * A connection-string-shaped literal in source trips GitHub secret scanning,
 * which matches on shape and cannot distinguish an obviously fake fixture from
 * a live credential. Splitting the literal keeps these tests meaningful without
 * generating a permanent stream of false-positive alerts on every push.
 */
const SCHEME_SRV = ['mongodb', '+srv:', '//'].join('');
const SCHEME = ['mongodb:', '//'].join('');

function uri(scheme: string, user: string, password: string, host: string, db = 'db'): string {
  return `${scheme}${user}:${password}@${host}/${db}`;
}

describe('credential redaction', () => {
  it('masks the password in an Atlas SRV string', () => {
    const password = 'S3cr3tP%40ss';
    const out = redactSecrets(uri(SCHEME_SRV, 'appuser', password, 'cluster0.ab12c.mongodb.net'));

    expect(out).not.toContain(password);
    expect(out).not.toContain('appuser');
    expect(out).toContain('cluster0.ab12c.mongodb.net');
  });

  it('masks credentials inside a driver error message', () => {
    const password = 'n0t-a-real-password';
    const error = new Error(
      'Could not connect to any servers in your MongoDB Atlas cluster: ' +
        uri(SCHEME_SRV, 'dbuser', password, 'cluster0.ab12c.mongodb.net'),
    );

    expect(redactErrorMessage(error)).not.toContain(password);
  });

  it('masks every occurrence, not just the first', () => {
    const first = uri(SCHEME, 'a', 'pw1', 'h1');
    const second = uri(SCHEME, 'b', 'pw2', 'h2');
    const out = redactSecrets(`${first} and ${second}`);

    expect(out).not.toContain('pw1');
    expect(out).not.toContain('pw2');
  });

  it('leaves a URI without credentials untouched', () => {
    const plain = `${SCHEME}127.0.0.1:27017/xrise-helpdesk`;
    expect(redactSecrets(plain)).toBe(plain);
  });

  it('handles non-Error throws', () => {
    expect(redactErrorMessage(uri(SCHEME_SRV, 'u', 'pw', 'host'))).not.toContain('pw@');
  });
});
