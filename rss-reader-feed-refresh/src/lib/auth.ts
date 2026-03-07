import type { FastifyRequest } from 'fastify';

import { getEnv } from './env.js';
import { UnauthorizedError } from './errors.js';

export function requireUserId(request: FastifyRequest): string {
  if (!request.userId) {
    const env = getEnv();
    if (env.DEMO_USER_ID) {
      return env.DEMO_USER_ID;
    }
    throw new UnauthorizedError();
  }

  return request.userId;
}
