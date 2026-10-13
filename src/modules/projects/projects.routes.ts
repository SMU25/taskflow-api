import type { FastifyPluginAsync } from 'fastify';
import z from 'zod';

import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { errorResponseSchema } from '../../schemas/common.schemas';
import {
  createProjectBodySchema,
  projectParamsSchema,
  projectResponseSchema,
  projectScopeParamsSchema,
  projectsListResponseSchema,
  updateProjectBodySchema,
} from './projects.schemas';
import { projectsService } from './projects.service';

export const projectRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.addHook('preHandler', fastify.authenticate);

  app.post(
    '/',
    {
      preHandler: fastify.requireMembership('MANAGER'),
      schema: {
        tags: ['Projects'],
        summary: 'Create a new project',
        security: [{ bearerAuth: [] }],
        params: projectScopeParamsSchema,
        body: createProjectBodySchema,
        response: {
          201: projectResponseSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const project = await projectsService.create(
        request.params.workspaceId,
        request.body,
      );

      return reply.status(201).send(project);
    },
  );

  app.get(
    '/',
    {
      preHandler: fastify.requireMembership('MEMBER'),
      schema: {
        tags: ['Projects'],
        summary: 'Get all projects for this workspace',
        security: [{ bearerAuth: [] }],
        params: projectScopeParamsSchema,
        response: {
          200: projectsListResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    (request) => {
      return projectsService.list(request.params.workspaceId);
    },
  );

  app.get(
    '/:projectId',
    {
      preHandler: fastify.requireMembership('MEMBER'),
      schema: {
        tags: ['Projects'],
        summary: 'Get a project by ID for this workspace',
        security: [{ bearerAuth: [] }],
        params: projectParamsSchema,
        response: {
          200: projectResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    (request) => {
      const { params } = request;

      return projectsService.itemById({
        id: params.projectId,
        workspaceId: params.workspaceId,
      });
    },
  );

  app.patch(
    '/:projectId',
    {
      preHandler: fastify.requireMembership('MANAGER'),
      schema: {
        tags: ['Projects'],
        summary: 'Update a project by ID for this workspace',
        security: [{ bearerAuth: [] }],
        params: projectParamsSchema,
        body: updateProjectBodySchema,
        response: {
          200: projectResponseSchema,
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    (request) => {
      const { params, body } = request;

      return projectsService.update(
        {
          id: params.projectId,
          workspaceId: params.workspaceId,
        },
        body,
      );
    },
  );

  app.delete(
    '/:projectId',
    {
      preHandler: fastify.requireMembership('MANAGER'),
      schema: {
        tags: ['Projects'],
        summary: 'Remove a project by ID for this workspace',
        security: [{ bearerAuth: [] }],
        params: projectParamsSchema,
        response: {
          204: z.void(),
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { params } = request;

      await projectsService.remove({
        id: params.projectId,
        workspaceId: params.workspaceId,
      });

      return reply.status(204).send();
    },
  );

  app.delete(
    '/:projectId/permanent',
    {
      preHandler: fastify.requireMembership('OWNER'),
      schema: {
        tags: ['Projects'],
        summary: 'Permanently delete a project by ID for this workspace',
        security: [{ bearerAuth: [] }],
        params: projectParamsSchema,
        response: {
          204: z.void(),
          400: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { params } = request;

      await projectsService.permanentlyDelete({
        id: params.projectId,
        workspaceId: params.workspaceId,
      });

      return reply.status(204).send();
    },
  );
};
