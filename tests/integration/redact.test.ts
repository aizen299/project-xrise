import { describe, expect, it } from 'vitest';
import { redactErrorMessage, redactSecrets } from '../../src/server/redact';

describe('credential redaction', () => {
  it('masks the password in an Atlas SRV string', () => {
    const uri = 'mongodb+srv://appuser:S3cr3tP%40ss@cluster0.ab12c.mongodb.net/xrise-helpdesk';
    const out = redactSecrets(uri);
    expect(out).not.toContain('S3cr3tP%40ss');
    expect(out).not.toContain('appuser');
    expect(out).toContain('cluster0.ab12c.mongodb.net');
  });

  it('masks credentials inside a driver error message', () => {
    const error = new Error(
      'Could not connect to any servers in your MongoDB Atlas cluster: ' +
        'mongodb+srv://admin:hunter2@cluster0.mongodb.net/db',
    );
    expect(redactErrorMessage(error)).not.toContain('hunter2');
  });

  it('masks every occurrence, not just the first', () => {
    const out = redactSecrets('mongodb://a:1@h1/db and mongodb://b:2@h2/db');
    expect(out).not.toMatch(/:1@|:2@/);
  });

  it('leaves a URI without credentials untouched', () => {
    const uri = 'mongodb://127.0.0.1:27017/xrise-helpdesk';
    expect(redactSecrets(uri)).toBe(uri);
  });

  it('handles non-Error throws', () => {
    expect(redactErrorMessage('mongodb+srv://u:p@host/db')).not.toContain(':p@');
  });
});
