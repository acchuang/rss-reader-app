import cors from '@fastify/cors';
import Fastify from 'fastify';
import { ZodError } from 'zod';

import { createServices } from './lib/container.js';
import { AppError, ValidationError } from './lib/errors.js';
import { getEnv } from './lib/env.js';
import { requestContextPlugin } from './plugins/requestContext.js';
import { registerRoutes } from './routes/index.js';

export async function buildApp() {
  const env = getEnv();
  const app = Fastify({
    logger: {
      level: env.LOG_LEVEL
    }
  });

  const services = createServices();

  await app.register(cors, {
    origin: true
  });
  await app.register(requestContextPlugin);
  await registerRoutes(app, services);

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      const validationError = new ValidationError('Invalid request', {
        issues: error.issues
      });
      return reply.status(validationError.statusCode).send({
        code: validationError.code,
        message: validationError.message,
        details: validationError.details
      });
    }

    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        code: error.code,
        message: error.message,
        details: error.details
      });
    }

    request.log.error(error);
    return reply.status(500).send({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error'
    });
  });

  return app;
}
