import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { UnauthorizedError } from '../lib/errors.js';

// Кличемо НА КОРЕНІ (не через app.register), щоб декоратор був глобальним.
// Через register він застряг би в дочірньому контексті (інкапсуляція Fastify).
export function registerAuth(app: FastifyInstance) {
  app.decorate(
    'authenticate',
    async (request: FastifyRequest, _reply: FastifyReply) => {
      try {
        await request.jwtVerify();
      } catch {
        throw new UnauthorizedError('Invalid or missing token');
      }

      const token = request.headers.authorization?.split(' ')[1];

      if (token) {
        const isBlacklisted = await app.redis.get(`blacklist:${token}`);

        if (isBlacklisted) {
          throw new UnauthorizedError('Token is invalidated');
        }
      }
    },
  );
}
