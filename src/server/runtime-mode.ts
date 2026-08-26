const mode = () => process.env.NODE_ENV?.trim();

export function isDevelopment(): boolean {
  return mode() === 'development';
}

export function isTest(): boolean {
  return mode() === 'test';
}

export function isLocal(): boolean {
  return isDevelopment() || isTest();
}
