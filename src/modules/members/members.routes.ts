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
      schema: {
        tags: ['Members'],
        summary: 'Add a Member to Workspace',
        security: [{ bearerAuth: [] }],
        params: memberScopeParamsSchema,
        body: addMemberBodySchema,
        response: {
          201: memberResponseSchema,
          400: memberResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user, params, body } = request;

      const member = await membersService.add(
        {
          userId: user.id,
          workspaceId: params.workspaceId,
        },
        body,
      );

      return reply.status(201).send(member);
    },
  );

  app.get(
    '/',
    {
      schema: {
        tags: ['Members'],
        summary: 'Get all Members for this workspace',
        security: [{ bearerAuth: [] }],
        params: memberScopeParamsSchema,
        response: {
          200: membersListResponseSchema,
          400: memberResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    (request) => {
      const { user, params } = request;

      return membersService.list({
        userId: user.id,
        workspaceId: params.workspaceId,
      });
    },
  );

  app.patch(
    '/:memberId',
    {
      schema: {
        tags: ['Members'],
        summary: 'Update a Member of Workspace',
        security: [{ bearerAuth: [] }],
        params: memberParamsSchema,
        body: updateMemberBodySchema,
        response: {
          200: memberResponseSchema,
          400: memberResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    (request) => {
      const { user, params, body } = request;

      return membersService.update(
        {
          userId: user.id,
          workspaceId: params.workspaceId,
          memberId: params.memberId,
        },
        body,
      );
    },
  );

  app.delete(
    '/:memberId',
    {
      schema: {
        tags: ['Members'],
        summary: 'Delete a Member from Workspace',
        security: [{ bearerAuth: [] }],
        params: memberParamsSchema,
        response: {
          204: z.void(),
          400: memberResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { user, params } = request;

      await membersService.delete({
        userId: user.id,
        workspaceId: params.workspaceId,
        memberId: params.memberId,
      });

      return reply.status(204).send();
    },
  );
};
