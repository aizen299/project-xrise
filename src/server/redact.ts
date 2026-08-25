/**
 * Masks credentials embedded in connection strings.
 *
 * MongoDB driver errors frequently quote the URI they failed on, which means
 * an Atlas password can end up in a log line, a terminal a developer screen-
 * shots, or a CI transcript. Everything that prints a caught connection error
 * runs through this first.
 */
const CREDENTIALS_IN_URI = /\/\/([^:/?#[\]@]+):([^@/?#]+)@/g;

export function redactSecrets(input: string): string {
  return input.replace(CREDENTIALS_IN_URI, '//***:***@');
}

/** Same, for an unknown thrown value. */
export function redactErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return redactSecrets(message);
}
