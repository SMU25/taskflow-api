import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { Role } from '../generated/prisma/enums';
import { ForbiddenError, NotFoundError } from '../lib/errors';
import { hasMinRole } from '../lib/rbac';
import { membersRepository } from '../modules/members/members.repository';

// Кличемо НА КОРЕНІ (не через app.register), щоб декоратор був глобальним.
// Через register він застряг би в дочірньому контексті (інкапсуляція Fastify).
export function registerMembership(app: FastifyInstance) {
  app.decorate(
    'requireMembership',
    (minRole: Role, options) =>
      async (request: FastifyRequest, _reply: FastifyReply) => {
        const { user, params } = request;
        const { workspaceId } = params as { workspaceId: string };

        const actor = await membersRepository.findActor({
          userId: user.id,
          workspaceId,
          includeDeleted: options?.allowDeleted ?? false,
        });

        if (!actor) {
          throw new NotFoundError('Workspace not found');
        }

        if (!hasMinRole(actor.role, minRole)) {
          throw new ForbiddenError('Insufficient permissions');
        }

        request.membership = actor;
      },
  );
}
