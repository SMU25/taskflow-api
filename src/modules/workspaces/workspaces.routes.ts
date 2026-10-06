import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { errorResponseSchema } from '../../schemas/common.schemas';
import {
  createWorkspaceBodySchema,
  updateWorkspaceBodySchema,
  workspaceParamsSchema,
  workspaceResponseSchema,
  workspacesListResponseSchema,
  workspacesTrashListResponseSchema,
} from './workspaces.schemas';
import { workspacesService } from './workspaces.service';

export const workspaceRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.addHook('preHandler', fastify.authenticate);

  app.post(
    '/',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'Create a new workspace',
        security: [{ bearerAuth: [] }],
        body: createWorkspaceBodySchema,
        response: { 201: workspaceResponseSchema, 400: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const workspace = await workspacesService.create(
        request.user.id,
        request.body,
      );

      return reply.status(201).send(workspace);
    },
  );

  app.get(
    '/',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'Get all workspaces for the authenticated user',
        security: [{ bearerAuth: [] }],
        response: { 200: workspacesListResponseSchema },
      },
    },
    (request) => workspacesService.list(request.user.id),
  );

  app.get(
    '/trash',
    {
      schema: {
        tags: ['Workspaces'],
        summary: 'Get all removed workspaces for the authenticated user',
        security: [{ bearerAuth: [] }],
        response: { 200: workspacesTrashListResponseSchema },
      },
    },
    (request) => workspacesService.removedList(request.user.id),
  );

  app.get(
    '/:workspaceId',
    {
      preHandler: fastify.requireMembership('MEMBER'),
      schema: {
        tags: ['Workspaces'],
        summary: 'Get a specific workspace for the authenticated user',
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
        response: {
          200: workspaceResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    (request) => workspacesService.itemById(request.params.workspaceId),
  );

  app.patch(
    '/:workspaceId',
    {
      preHandler: fastify.requireMembership('ADMIN'),
      schema: {
        tags: ['Workspaces'],
        summary: 'Update a workspace by ID',
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
        body: updateWorkspaceBodySchema,
        response: {
          200: workspaceResponseSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    (request) =>
      workspacesService.update(request.params.workspaceId, request.body),
  );

  app.delete(
    '/:workspaceId',
    {
      preHandler: fastify.requireMembership('OWNER'),
      schema: {
        tags: ['Workspaces'],
        summary: 'Remove a workspace by ID',
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
        response: {
          204: z.void(),
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      await workspacesService.remove(request.params.workspaceId);

      return reply.status(204).send();
    },
  );

  app.delete(
    '/:workspaceId/permanent',
    {
      preHandler: fastify.requireMembership('OWNER', { allowDeleted: true }),
      schema: {
        tags: ['Workspaces'],
        summary: 'Permanently delete a workspace by ID',
        security: [{ bearerAuth: [] }],
        params: workspaceParamsSchema,
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
      await workspacesService.permanentlyDelete(request.params.workspaceId);

      return reply.status(204).send();
    },
  );
};
