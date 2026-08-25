import type { AppError } from '../../src/server/errors';

export async function rejection(promise: Promise<unknown>): Promise<AppError> {
  try {
    await promise;
    throw new Error('Expected the promise to reject, but it resolved.');
  } catch (error) {
    return error as AppError;
  }
}
