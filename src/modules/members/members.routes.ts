import { type FastifyPluginAsync } from 'fastify';
import z from 'zod';

import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { errorResponseSchema } from '../../schemas/common.schemas';
import {
  addMemberBodySchema,
  memberParamsSchema,
  memberResponseSchema,
  memberScopeParamsSchema,
  membersListResponseSchema,
  updateMemberBodySchema,
} from './members.schemas';
import { membersService } from './members.service';

export const memberRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.addHook('preHandler', fastify.authenticate);

  app.post(
    '/',
    {
      preHandler: fastify.requireMembership('ADMIN'),
      schema: {
        tags: ['Members'],
        summary: 'Add a Member to Workspace',
        security: [{ bearerAuth: [] }],
        params: memberScopeParamsSchema,
        body: addMemberBodySchema,
        response: {
          201: memberResponseSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user, params, body, membership } = request;

      const actor = {
        userId: user.id,
        workspaceId: params.workspaceId,
        role: membership.role,
      };

      const member = await membersService.add(actor, body);

      return reply.status(201).send(member);
    },
  );

  app.get(
    '/',
    {
      preHandler: fastify.requireMembership('MEMBER'),
      schema: {
        tags: ['Members'],
        summary: 'Get all Members for this workspace',
        security: [{ bearerAuth: [] }],
        params: memberScopeParamsSchema,
        response: {
          200: membersListResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    (request) => {
      const { params } = request;

      return membersService.list(params.workspaceId);
    },
  );

  app.patch(
    '/:memberId',
    {
      preHandler: fastify.requireMembership('ADMIN'),
      schema: {
        tags: ['Members'],
        summary: 'Update a Member of Workspace',
        security: [{ bearerAuth: [] }],
        params: memberParamsSchema,
        body: updateMemberBodySchema,
        response: {
          200: memberResponseSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    (request) => {
      const { user, params, body, membership } = request;

      const actor = {
        userId: user.id,
        workspaceId: params.workspaceId,
        role: membership.role,
      };

      return membersService.update(actor, params.memberId, body);
    },
  );

  app.delete(
    '/:memberId',
    {
      preHandler: fastify.requireMembership('MEMBER'),
      schema: {
        tags: ['Members'],
        summary: 'Delete a Member from Workspace',
        security: [{ bearerAuth: [] }],
        params: memberParamsSchema,
        response: {
          204: z.void(),
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user, params, membership } = request;

      const actor = {
        userId: user.id,
        workspaceId: params.workspaceId,
        role: membership.role,
      };

      await membersService.delete(actor, params.memberId);

      return reply.status(204).send();
    },
  );
};
