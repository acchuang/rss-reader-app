import type { FastifyInstance, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
}

function readUserId(request: FastifyRequest): string | undefined {
  const header = request.headers['x-user-id'];
  return typeof header === 'string' && header.length > 0 ? header : undefined;
}

export async function requestContextPlugin(app: FastifyInstance): Promise<void> {
  app.addHook('onRequest', async (request) => {
    request.userId = readUserId(request);
  });
}
