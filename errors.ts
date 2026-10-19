export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly expose: boolean;

  constructor(status: number, code: string, message: string, expose = true) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.expose = expose;
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      body: { error: { code: error.code, message: error.expose ? error.message : 'The request could not be completed.' } },
    };
  }
  console.error('[sharing-api] unhandled error', error);
  return {
    status: 500,
    body: { error: { code: 'INTERNAL_ERROR', message: 'The request could not be completed.' } },
  };
}

export function requireText(value: unknown, field: string, maxLength: number, minLength = 1) {
  if (typeof value !== 'string') throw new ApiError(400, 'INVALID_INPUT', `${field} is required.`);
  const text = value.trim();
  if (text.length < minLength || text.length > maxLength) {
    throw new ApiError(400, 'INVALID_INPUT', `${field} must be between ${minLength} and ${maxLength} characters.`);
  }
  return text;
}

export function parseExpiresAt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const timestamp = typeof value === 'number' ? value : Date.parse(String(value));
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
    throw new ApiError(400, 'INVALID_EXPIRATION', 'Expiration must be a valid future date.');
  }
  return Math.floor(timestamp);
}
