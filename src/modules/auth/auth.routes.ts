import bcrypt from 'bcrypt';
import type { FastifyPluginAsync } from 'fastify';

import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { prisma } from '../../lib/prisma.js';
import {
  errorResponseSchema,
  loginBodySchema,
  loginResponseSchema,
  logoutResponseSchema,
  registerBodySchema,
  userResponseSchema,
} from './auth.schemas.js';

// Автоматична валідація через Fastify Type Provider! 🔥
export const authRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  // Реєстрація - автоматична валідація!
  app.post(
    '/register',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Register a new user',
        body: registerBodySchema,
        response: {
          201: userResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      // request.body вже валідований та типізований!
      const { email, password } = request.body;
      const hashedPassword = await bcrypt.hash(password, 10);

      try {
        const user = await prisma.user.create({
          data: { email, password: hashedPassword },
          select: { id: true, email: true, createdAt: true },
        });

        return reply.status(201).send(user);
      } catch (e) {
        console.error('REGISTER ERROR:', e);
        return reply.status(400).send({ message: 'User already exists' });
      }
    },
  );

  // Логін
  app.post(
    '/login',
    {
      schema: {
        tags: ['Auth'],
        summary: 'Login and receive JWT token',
        body: loginBodySchema,
        response: {
          200: loginResponseSchema,
          401: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user || !(await bcrypt.compare(password, user.password))) {
        return reply.status(401).send({ message: 'Invalid credentials' });
      }

      const token = fastify.jwt.sign({ id: user.id, email: user.email });

      const { password: _pw, ...userWithoutPassword } = user;
      return reply.code(200).send({ token, user: userWithoutPassword });
    },
  );

  // Логаут
  app.post(
    '/logout',
    {
      preHandler: [fastify.authenticate],
      schema: {
        tags: ['Auth'],
        summary: 'Logout and invalidate JWT token',
        security: [{ bearerAuth: [] }],
        response: {
          200: logoutResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const token = request.headers.authorization?.split(' ')[1];
      if (!token) {
        return reply.status(400).send({ message: 'Token not provided' });
      }

      await fastify.redis.set(`blacklist:${token}`, 'true', 'EX', 3600);

      return reply.code(200).send({ message: 'Logged out successfully' });
    },
  );
};
