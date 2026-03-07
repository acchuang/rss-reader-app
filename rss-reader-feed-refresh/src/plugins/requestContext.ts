import type { FastifyInstance, FastifyRequest } from 'fastify';

import { getEnv } from '../lib/env.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
}

function readUserId(request: FastifyRequest): string | undefined {
  const header = request.headers['x-user-id'];
  if (typeof header === 'string' && header.length > 0) {
    return header;
  }

  const authHeader = request.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    return token.length > 0 ? token : undefined;
  }

  const url = new URL(request.url, 'http://localhost');
  const queryUserId = url.searchParams.get('userId');
  if (queryUserId && queryUserId.length > 0) {
    return queryUserId;
  }

  return undefined;
}

export async function requestContextPlugin(app: FastifyInstance): Promise<void> {
  const env = getEnv();

  app.addHook('onRequest', async (request) => {
    request.userId = readUserId(request) ?? env.DEMO_USER_ID;
  });
}
