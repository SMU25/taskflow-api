import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import type { ZodTypeProvider } from 'fastify-type-provider-zod';

import { errorResponseSchema } from '../../schemas/common.schemas.js';
import {
  createTaskBodySchema,
  taskParamsSchema,
  taskResponseSchema,
  taskUpdateResponseSchema,
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
      schema: {
        tags: ['Tasks'],
        summary: 'Create a new task',
        security: [{ bearerAuth: [] }],
        body: createTaskBodySchema,
        response: { 201: taskResponseSchema, 400: errorResponseSchema },
      },
    },
    async (request, reply) => {
      const task = await tasksService.create(request.user.id, request.body);
      return reply.status(201).send(task);
    },
  );

  app.get(
    '/',
    {
      schema: {
        tags: ['Tasks'],
        summary: 'Get all tasks for the authenticated user',
        security: [{ bearerAuth: [] }],
        response: { 200: tasksListResponseSchema },
      },
    },
    (request) => tasksService.list(request.user.id),
  );

  app.put(
    '/:id',
    {
      schema: {
        tags: ['Tasks'],
        summary: 'Update a task by ID',
        security: [{ bearerAuth: [] }],
        params: taskParamsSchema,
        body: updateTaskBodySchema,
        response: {
          200: taskUpdateResponseSchema,
          404: errorResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    (request) =>
      tasksService.update(request.user.id, request.params.id, request.body),
  );

  app.delete(
    '/:id',
    {
      schema: {
        tags: ['Tasks'],
        summary: 'Delete a task by ID',
        security: [{ bearerAuth: [] }],
        params: taskParamsSchema,
        response: { 204: z.void(), 404: errorResponseSchema },
      },
    },
    async (request, reply) => {
      await tasksService.remove(request.user.id, request.params.id);
      return reply.status(204).send();
    },
  );
};
