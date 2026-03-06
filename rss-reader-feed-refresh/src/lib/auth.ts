import type { FastifyRequest } from 'fastify';

import { UnauthorizedError } from './errors.js';

export function requireUserId(request: FastifyRequest): string {
  if (!request.userId) {
    throw new UnauthorizedError();
  }

  return request.userId;
}
