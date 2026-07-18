import Fastify from 'fastify';

import fastifyJwt from '@fastify/jwt';
import fastifyRedis from '@fastify/redis';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { taskRoutes } from './modules/tasks/tasks.routes.js';
import { registerAuth } from './plugins/auth.js';
import { registerErrorHandler } from './plugins/errorHandler.js';

export function buildApp() {
  const app = Fastify({ logger: true });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  app.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'TaskFlow API',
        description: 'REST API for task management with JWT authentication',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      tags: [
        { name: 'Auth', description: 'Registration, login, logout' },
        { name: 'Tasks', description: 'CRUD operations for tasks' },
      ],
    },
    transform: jsonSchemaTransform,
  });

  app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: true },
  });

  app.register(fastifyJwt, { secret: env.JWT_SECRET });
  app.register(fastifyRedis, { url: env.REDIS_URL });

  registerAuth(app); // decorate fastify.authenticate — ДО реєстрації роутів, що його юзають
  registerErrorHandler(app); // setErrorHandler — тепер конверт помилок активний

  app.register(authRoutes, { prefix: '/api/auth' });
  app.register(taskRoutes, { prefix: '/api/tasks' });

  app.get('/ping', { schema: { hide: true } }, async () => ({
    status: 'OK',
    message: 'Server is running!',
  }));

  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });

  return app;
}
