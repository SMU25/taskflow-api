import { FastifyReply, type preHandlerHookHandler } from 'fastify';

import '@fastify/jwt';

import type { Role } from '../generated/prisma/enums';

declare module 'fastify' {
  interface FastifyInstance {
    authenticate(request: FastifyRequest, reply: FastifyReply): Promise<void>;
    requireMembership(
      minRole: Role,
      options?: { allowDeleted?: boolean },
    ): preHandlerHookHandler;
  }

  interface FastifyRequest {
    membership: { role: Role };
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      id: string;
      email: string;
    };
  }
}
