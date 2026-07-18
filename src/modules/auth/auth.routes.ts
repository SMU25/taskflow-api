import type { FastifyPluginAsync } from 'fastify';

import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { UnauthorizedError } from '../../lib/errors.js';
import { errorResponseSchema } from '../../schemas/common.schemas.js';
import {
  loginBodySchema,
  loginResponseSchema,
  logoutResponseSchema,
  registerBodySchema,
  userResponseSchema,
} from './auth.schemas.js';
import { authService } from './auth.service.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.post(
    '/register',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Register a new user',
        body: registerBodySchema,
        response: { 201: userResponseSchema, 409: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const user = await authService.register(request.body);

      return reply.status(201).send(user);
    },
  );

  app.post(
    '/login',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Login and receive JWT token',
        body: loginBodySchema,
        response: { 200: loginResponseSchema, 401: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const user = await authService.validateCredentials(request.body);
      // JWT-підпис — інфраструктура Fastify, лишаємо на межі. У Фазі 4 винесемо в TokenService.
      const token = fastify.jwt.sign({ id: user.id, email: user.email });

      return reply.send({ token, user });
    },
  );

  app.post(
    '/logout',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Logout and invalidate JWT token',
        security: [{ bearerAuth: [] }],
        response: { 200: logoutResponseSchema, 401: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const token = request.headers.authorization?.split(' ')[1];

      if (!token) throw new UnauthorizedError('Token not provided');

      await fastify.redis.set(`blacklist:${token}`, 'true', 'EX', 3600);

      return reply.send({ message: 'Logged out successfully' });
    },
  );
};
