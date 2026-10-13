import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { errorResponseSchema } from '../../schemas/common.schemas.js';
import {
  createTaskBodySchema,
  taskParamsSchema,
  taskParamsScopeSchema,
  taskResponseSchema,
  tasksListResponseSchema,
  updateTaskBodySchema,
} from './tasks.schemas.js';
import { tasksService } from './tasks.service.js';

export const taskRoutes: FastifyPluginAsync = async (fastify) => {
  const app = fastify.withTypeProvider<ZodTypeProvider>();

  app.addHook('preHandler', fastify.authenticate);

  app.post(
    '/',
    {
      preHandler: fastify.requireMembership('MEMBER'),
      schema: {
        tags: ['Tasks'],
        summary: 'Create a new task',
        security: [{ bearerAuth: [] }],
        params: taskParamsScopeSchema,
        body: createTaskBodySchema,
        response: {
          201: taskResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { params, body, user } = request;

      const task = await tasksService.create(
        {
          projectId: params.projectId,
          workspaceId: params.workspaceId,
        },
        user.id,
        body,
      );

      return reply.status(201).send(task);
    },
  );

  app.get(
    '/',
    {
      preHandler: fastify.requireMembership('MEMBER'),
      schema: {
        tags: ['Tasks'],
        summary: 'List tasks of the project',
        security: [{ bearerAuth: [] }],
        params: taskParamsScopeSchema,
        response: {
          200: tasksListResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    (request) => {
      const { params } = request;

      return tasksService.list({
        projectId: params.projectId,
        workspaceId: params.workspaceId,
      });
    },
  );

  app.get(
    '/:taskId',
    {
      preHandler: fastify.requireMembership('MEMBER'),
      schema: {
        tags: ['Tasks'],
        summary: 'Get a task by ID',
        security: [{ bearerAuth: [] }],
        params: taskParamsSchema,
        response: {
          200: taskResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    (request) => {
      const { params } = request;

      return tasksService.itemById({
        id: params.taskId,
        projectId: params.projectId,
        workspaceId: params.workspaceId,
      });
    },
  );

  app.patch(
    '/:taskId',
    {
      preHandler: fastify.requireMembership('MEMBER'),
      schema: {
        tags: ['Tasks'],
        summary: 'Update a task by ID',
        security: [{ bearerAuth: [] }],
        params: taskParamsSchema,
        body: updateTaskBodySchema,
        response: {
          200: taskResponseSchema,
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    (request) => {
      const { params, body } = request;

      return tasksService.update(
        {
          id: params.taskId,
          projectId: params.projectId,
          workspaceId: params.workspaceId,
        },
        body,
      );
    },
  );

  app.delete(
    '/:taskId',
    {
      preHandler: fastify.requireMembership('MEMBER'),
      schema: {
        tags: ['Tasks'],
        summary: 'Delete a task by ID',
        security: [{ bearerAuth: [] }],
        params: taskParamsSchema,
        response: {
          204: z.void(),
          400: errorResponseSchema,
          404: errorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      const { params } = request;

      await tasksService.remove({
        id: params.taskId,
        projectId: params.projectId,
        workspaceId: params.workspaceId,
      });

      return reply.status(204).send();
    },
  );

  app.delete(
    '/:taskId/permanent',
    {
      preHandler: fastify.requireMembership('OWNER'),
      schema: {
        tags: ['Tasks'],
        summary: 'Permanently delete a trashed task (OWNER)',
        security: [{ bearerAuth: [] }],
        params: taskParamsSchema,
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

      await tasksService.permanentlyDelete({
        id: params.taskId,
        projectId: params.projectId,
        workspaceId: params.workspaceId,
      });

      return reply.status(204).send();
    },
  );
};
