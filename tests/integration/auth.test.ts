import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { clearTestDb, startTestDb, stopTestDb } from '../helpers/db';
import { User } from '../../src/server/db/models';
import { hashPassword } from '../../src/server/auth/password';
import { signSessionToken, verifySessionToken, type SessionClaims } from '../../src/server/auth/jwt';
import { authenticateAgent } from '../../src/server/services/auth.service';
import type { AppError } from '../../src/server/errors';


async function rejection(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
    throw new Error('Expected the promise to reject, but it resolved.');
  } catch (error) {
    return error as AppError;
  }
}

const CLAIMS: SessionClaims = {
  sub: '507f1f77bcf86cd799439011',
  role: 'agent',
  name: 'Agent One',
  email: 'agent1@xriseai.com',
};

const key = () => new TextEncoder().encode(process.env.JWT_SECRET!);

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

describe('session tokens', () => {
  it('round-trips the claims it was given', async () => {
    const token = await signSessionToken(CLAIMS);
    await expect(verifySessionToken(token)).resolves.toEqual(CLAIMS);
  });

  it('rejects an expired token', async () => {
    const token = await signSessionToken(CLAIMS, -60); // already past
    await expect(verifySessionToken(token)).resolves.toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    const foreign = new TextEncoder().encode('a-completely-different-secret-32-chars!!');
    const token = await new SignJWT({ role: 'admin', name: 'X', email: 'x@y.z' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(CLAIMS.sub)
      .setIssuedAt()
      .setExpirationTime('1h')
      .setIssuer('xrise-helpdesk')
      .setAudience('xrise-agents')
      .sign(foreign);
    await expect(verifySessionToken(token)).resolves.toBeNull();
  });

  it('rejects a token whose payload was edited after signing', async () => {
    const token = await signSessionToken(CLAIMS);
    const [header, payload, signature] = token.split('.');
    const decoded = JSON.parse(Buffer.from(payload!, 'base64url').toString());

    decoded.role = 'admin';

    const forgedPayload = Buffer.from(JSON.stringify(decoded)).toString('base64url');
    await expect(verifySessionToken(`${header}.${forgedPayload}.${signature}`)).resolves.toBeNull();
  });

  it('rejects an unsigned "alg: none" token', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: CLAIMS.sub,
        role: 'admin',
        name: 'X',
        email: 'x@y.z',
        iss: 'xrise-helpdesk',
        aud: 'xrise-agents',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString('base64url');
    await expect(verifySessionToken(`${header}.${payload}.`)).resolves.toBeNull();
  });

  it('rejects a token issued for a different audience', async () => {
    const token = await new SignJWT({ role: 'agent', name: 'X', email: 'x@y.z' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(CLAIMS.sub)
      .setIssuedAt()
      .setExpirationTime('1h')
      .setIssuer('xrise-helpdesk')
      .setAudience('some-other-app')
      .sign(key());
    await expect(verifySessionToken(token)).resolves.toBeNull();
  });

  it('rejects a validly signed token carrying an unknown role', async () => {
    const token = await new SignJWT({ role: 'superuser', name: 'X', email: 'x@y.z' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(CLAIMS.sub)
      .setIssuedAt()
      .setExpirationTime('1h')
      .setIssuer('xrise-helpdesk')
      .setAudience('xrise-agents')
      .sign(key());
    await expect(verifySessionToken(token)).resolves.toBeNull();
  });

  it('rejects garbage', async () => {
    for (const bad of ['', 'not.a.token', 'a.b.c', 'null']) {
      await expect(verifySessionToken(bad)).resolves.toBeNull();
    }
  });
});

describe('agent login', () => {
  beforeEach(async () => {
    await User.create({
      email: 'agent1@xriseai.com',
      name: 'Agent One',
      role: 'agent',
      passwordHash: await hashPassword('Password123!'),
    });
  });

  it('returns session claims for correct credentials', async () => {
    const claims = await authenticateAgent({
      email: 'agent1@xriseai.com',
      password: 'Password123!',
    });
    expect(claims).toMatchObject({ role: 'agent', email: 'agent1@xriseai.com', name: 'Agent One' });
    expect(claims.sub).toMatch(/^[a-f0-9]{24}$/);
  });

  it('never puts the password hash in the claims', async () => {
    const claims = await authenticateAgent({
      email: 'agent1@xriseai.com',
      password: 'Password123!',
    });
    expect(JSON.stringify(claims)).not.toContain('$2');
    expect(Object.keys(claims).sort()).toEqual(['email', 'name', 'role', 'sub']);
  });

  it('rejects a wrong password', async () => {
    await expect(
      authenticateAgent({ email: 'agent1@xriseai.com', password: 'wrong' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('gives an unknown address exactly the same error as a wrong password', async () => {
    
    const wrongPassword = await rejection(
      authenticateAgent({ email: 'agent1@xriseai.com', password: 'wrong' }),
    );
    const unknownUser = await rejection(
      authenticateAgent({ email: 'nobody@xriseai.com', password: 'wrong' }),
    );

    expect(unknownUser.message).toBe(wrongPassword.message);
    expect(unknownUser.code).toBe(wrongPassword.code);
    expect(unknownUser.status).toBe(wrongPassword.status);
  });

  it('produces a token that verifies back to the same agent', async () => {
    const claims = await authenticateAgent({
      email: 'agent1@xriseai.com',
      password: 'Password123!',
    });
    const token = await signSessionToken(claims);
    await expect(verifySessionToken(token)).resolves.toEqual(claims);
  });
});
