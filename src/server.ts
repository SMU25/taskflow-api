import Fastify from 'fastify';

import fastifyJwt from '@fastify/jwt';
import fastifyRedis from '@fastify/redis';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import 'dotenv/config';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';

import { env } from './config/env';
import { initScheduler } from './lib/cron';
import { authRoutes } from './modules/auth/auth.routes';
import { taskRoutes } from './modules/tasks/tasks.routes';

const server = Fastify({ logger: true });

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

// Swagger / OpenAPI
server.register(swagger, {
  openapi: {
    openapi: '3.0.0',
    info: {
      title: 'TaskFlow API',
      description: 'REST API for task management with JWT authentication',
      version: '1.0.0',
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    tags: [
      { name: 'Auth', description: 'Registration, login, logout' },
      { name: 'Tasks', description: 'CRUD operations for tasks' },
    ],
  },
  transform: jsonSchemaTransform,
});

server.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: { docExpansion: 'list', deepLinking: true },
});

// Реєстрація плагінів
server.register(fastifyJwt, { secret: env.JWT_SECRET });
server.register(fastifyRedis, { url: env.REDIS_URL });

// Декоратор для захисту маршрутів (Аутентифікація)
server.decorate('authenticate', async (request, reply) => {
  try {
    await request.jwtVerify();

    // Перевірка чи токен не в блеклісті Redis
    const token = request.headers.authorization?.split(' ')[1];
    const isBlacklisted = await server.redis.get(`blacklist:${token}`);

    if (isBlacklisted) {
      return reply.status(401).send({ message: 'Token is invalidated' });
    }
  } catch (err) {
    reply.send(err);
  }
});

// Реєстрація модульних маршрутів
server.register(authRoutes, { prefix: '/api/auth' });
server.register(taskRoutes, { prefix: '/api/tasks' });

server.get('/ping', { schema: { hide: true } }, async () => {
  return { status: 'OK', message: 'Server is running!' };
});

const start = async () => {
  try {
    await server.listen({ port: 5000, host: '0.0.0.0' });
    console.log('🚀 Server running at http://localhost:5000');

    initScheduler();
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
