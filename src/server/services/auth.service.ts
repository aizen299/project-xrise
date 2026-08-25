import { User } from '../db/models';
import { unauthorized } from '../errors';
import { burnPasswordComparison, verifyPassword } from '../auth/password';
import type { SessionClaims } from '../auth/jwt';
import type { LoginInput } from '../validation/schemas';


const INVALID_CREDENTIALS = 'Invalid email or password.';

export async function authenticateAgent(input: LoginInput): Promise<SessionClaims> {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');

  if (!user) {

    await burnPasswordComparison(input.password);
    throw unauthorized(INVALID_CREDENTIALS);
  }

  if (!(await verifyPassword(input.password, user.passwordHash))) {
    throw unauthorized(INVALID_CREDENTIALS);
  }

  return {
    sub: user._id.toString(),
    role: user.role,
    name: user.name,
    email: user.email,
  };
}
