export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(422, 'VALIDATION_ERROR', message, details);
  }
}

export class InvalidFeedError extends AppError {
  constructor(message = 'The provided URL does not resolve to a valid feed') {
    super(422, 'INVALID_FEED', message);
  }
}

export class UpstreamUnavailableError extends AppError {
  constructor(message = 'Upstream feed is unavailable') {
    super(503, 'UPSTREAM_UNAVAILABLE', message);
  }
}

export class NotImplementedAppError extends AppError {
  constructor(message: string) {
    super(501, 'NOT_IMPLEMENTED', message);
  }
}
